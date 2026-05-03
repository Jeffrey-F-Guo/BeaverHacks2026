import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import ProgressBar from '../../src/components/ProgressBar';
import { api, TopicDetail, PipelineStatus, DebateRound } from '../../src/services/api';

const VOTE_RED = '#b05050';
const VOTE_BLUE = '#4060b0';

type Section = { label: string; content: string };

function BriefingSection({ label, content }: Section) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        activeOpacity={0.7}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.sectionLabel}>{label}</Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.OUTLINE}
        />
      </TouchableOpacity>
      {expanded && <Text style={[styles.sectionBody, { marginTop: 10 }]}>{content}</Text>}
    </View>
  );
}

type RoundGroup = { round_number: number; red: DebateRound | null; blue: DebateRound | null };

function groupRounds(rounds: DebateRound[]): RoundGroup[] {
  const map = new Map<number, RoundGroup>();
  for (const r of rounds) {
    if (!map.has(r.round_number))
      map.set(r.round_number, { round_number: r.round_number, red: null, blue: null });
    const g = map.get(r.round_number)!;
    if (r.speaker === 'red') g.red = r; else g.blue = r;
  }
  return Array.from(map.values()).sort((a, b) => a.round_number - b.round_number);
}

function TurnCard({ turn, sideLabel, accentColor }: { turn: DebateRound; sideLabel: string; accentColor: string }) {
  return (
    <View style={[styles.turnCard, { borderLeftWidth: 3, borderLeftColor: accentColor }]}>
      <Text style={[styles.turnSideLabel, { color: accentColor }]}>{sideLabel}</Text>
      <Text style={styles.turnKeyClaim}>{turn.key_claim}</Text>
      <Text style={styles.turnArgument}>{turn.argument}</Text>
      {turn.concession ? (
        <View style={styles.concessionBox}>
          <Text style={styles.concessionLabel}>CONCEDES</Text>
          <Text style={styles.concessionText}>{turn.concession}</Text>
        </View>
      ) : null}
      {turn.evidence_cited.length > 0 ? (
        <View style={styles.evidenceBlock}>
          <Text style={styles.evidenceLabel}>EVIDENCE CITED</Text>
          {turn.evidence_cited.map((e, i) => (
            <View key={i} style={styles.evidenceRow}>
              <Text style={styles.evidenceDot}>·</Text>
              <Text style={styles.evidenceText}>{e}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DebateTranscript({ rounds, poleA, poleB }: { rounds: DebateRound[]; poleA: string; poleB: string }) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupRounds(rounds);
  if (groups.length === 0) return null;
  return (
    <View style={styles.transcriptCard}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        activeOpacity={0.7}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.debateTitle}>The Debate</Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.OUTLINE}
        />
      </TouchableOpacity>
      {expanded && groups.map((g) => (
        <View key={g.round_number} style={styles.roundBlock}>
          <Text style={styles.roundLabel}>Round {g.round_number}</Text>
          {g.red && <TurnCard turn={g.red} sideLabel={poleA} accentColor={VOTE_RED} />}
          {g.blue && <TurnCard turn={g.blue} sideLabel={poleB} accentColor={VOTE_BLUE} />}
        </View>
      ))}
    </View>
  );
}

function pipelinePercent(status: PipelineStatus): number {
  const stages = ['research', 'debate', 'summary', 'scripts', 'audio', 'video'] as const;
  const done = stages.filter((s) => status[s] === 'complete').length;
  return Math.round((done / stages.length) * 100);
}

export default function DeepDiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getTopic(id),
      api.getDebateRounds(id).catch(() => [] as DebateRound[]),
    ]).then(([t, r]) => {
      setTopic(t);
      setRounds(r);
      if (t.pipeline_status?.video !== 'complete') {
        pollRef.current = setInterval(async () => {
          try {
            const updated = await api.getPipelineStatus(id);
            setTopic((prev) => prev ? { ...prev, pipeline_status: updated } : prev);
            if (updated.video === 'complete') clearInterval(pollRef.current!);
          } catch {}
        }, 5000);
      }
    }).catch(() => {}).finally(() => setLoading(false));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const percent = topic ? pipelinePercent(topic.pipeline_status) : 0;
  const pipelineComplete = topic?.pipeline_status?.video === 'complete';

  const sections: Section[] = topic?.briefing
    ? [
        { label: 'Origin', content: topic.briefing.origin },
        { label: 'Key Players', content: topic.briefing.key_players },
        { label: `The Case For ${topic.pole_a}`, content: topic.briefing.case_for_a },
        { label: `The Case Against ${topic.pole_a}`, content: topic.briefing.case_for_b },
        { label: 'Consequences', content: topic.briefing.consequences },
        { label: 'Where We Stand', content: topic.briefing.current_state },
      ]
    : [];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.ON_SURFACE} />
          </TouchableOpacity>
          <Text style={styles.wordmark}>Verdict.</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!topic) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.ON_SURFACE} />
          </TouchableOpacity>
          <Text style={styles.wordmark}>Verdict.</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.loader}>
          <Text style={styles.errorText}>Research not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>Verdict</Text>
        <View style={{ width: 30 }} />
      </View>
      <ProgressBar percent={percent} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!pipelineComplete && (
          <Text style={styles.processingTag}>• Processing</Text>
        )}

        <Text style={styles.topicTitle}>{topic.topic}</Text>

        {!pipelineComplete && (
          <View style={styles.pendingCard}>
            <ActivityIndicator color={Colors.PRIMARY} size="small" />
            <Text style={styles.pendingText}>
              Research pipeline is still running. Check back soon.
            </Text>
          </View>
        )}

        {sections.length > 0 ? (
          sections.map((s) => (
            <BriefingSection key={s.label} label={s.label} content={s.content} />
          ))
        ) : (
          pipelineComplete && (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingText}>No briefing available yet.</Text>
            </View>
          )
        )}

        {rounds.length > 0 && (
          <DebateTranscript rounds={rounds} poleA={topic.pole_a} poleB={topic.pole_b} />
        )}

        {topic.debate_summary && (
          <View style={styles.debateCard}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              activeOpacity={0.7}
              onPress={() => setSummaryExpanded((v) => !v)}
            >
              <Text style={styles.debateTitle}>Debate Summary</Text>
              <MaterialCommunityIcons
                name={summaryExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.OUTLINE}
              />
            </TouchableOpacity>
            {summaryExpanded && (
              <View style={{ marginTop: 12, gap: 4 }}>
                <Text style={[styles.sideLabel, { color: VOTE_RED }]}>{topic.pole_a}</Text>
                {topic.debate_summary.side_a_points.map((pt, i) => (
                  <Text key={i} style={styles.bulletPoint}>• {pt}</Text>
                ))}
                <View style={styles.divider} />
                <Text style={[styles.sideLabel, { color: VOTE_BLUE }]}>{topic.pole_b}</Text>
                {topic.debate_summary.side_b_points.map((pt, i) => (
                  <Text key={i} style={styles.bulletPoint}>• {pt}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.voteButton}
          activeOpacity={0.85}
          onPress={() => router.push(`/topic/${id}`)}
        >
          <MaterialCommunityIcons name="vote" size={18} color={Colors.ON_PRIMARY} />
          <Text style={styles.voteButtonText}>Go Vote</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.SURFACE_CONTAINER_LOWEST },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 20,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderBottomWidth: 1,
    borderBottomColor: Colors.SURFACE_CONTAINER_LOW,
  },
  wordmark: {
    fontFamily: 'PlayfairDisplay_700Bold_Italic',
    fontSize: 27,
    color: Colors.ON_SURFACE,
    letterSpacing: -0.3,
  },
  backBtn: { padding: 4 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 16,
    color: Colors.OUTLINE,
  },
  scroll: { flex: 1, backgroundColor: Colors.SURFACE },
  scrollContent: { padding: 20, paddingBottom: 48, gap: 20 },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  processingTag: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.OUTLINE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topicTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 24,
    lineHeight: 30,
    color: Colors.ON_SURFACE,
    letterSpacing: -0.3,
  },

  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
  },
  pendingText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.OUTLINE,
    lineHeight: 18,
  },

  section: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
  },
  sectionBody: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: Colors.ON_SURFACE_VARIANT,
  },

  debateCard: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  debateTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.ON_SURFACE,
    marginBottom: 4,
  },
  sideLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
    marginTop: 4,
  },
  bulletPoint: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ON_SURFACE_VARIANT,
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
    marginVertical: 8,
  },

  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.PRIMARY,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 4,
  },
  voteButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.ON_PRIMARY,
    letterSpacing: 0.2,
  },

  transcriptCard: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  roundBlock: {
    gap: 8,
  },
  roundLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.OUTLINE,
  },
  turnCard: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
    borderRadius: 6,
    padding: 14,
    gap: 6,
  },
  turnSideLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
  },
  turnKeyClaim: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.ON_SURFACE,
  },
  turnArgument: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ON_SURFACE_VARIANT,
  },
  concessionBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 6,
    padding: 10,
    gap: 4,
    marginTop: 2,
  },
  concessionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    color: '#b45309',
  },
  concessionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#78350f',
  },

  evidenceBlock: {
    gap: 4,
    marginTop: 4,
  },
  evidenceLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1,
    color: Colors.OUTLINE,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  evidenceDot: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.OUTLINE,
    lineHeight: 18,
  },
  evidenceText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
    color: Colors.OUTLINE,
  },
});
