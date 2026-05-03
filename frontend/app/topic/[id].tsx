import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { isAllWatched } from '../../src/services/watchStore';
import { Colors } from '../../src/theme/colors';
import VeracityBadge from '../../src/components/VeracityBadge';
import ProgressBar from '../../src/components/ProgressBar';
import SpectrumChart from '../../src/components/SpectrumChart';
import { api, TopicDetail, VoteDistribution } from '../../src/services/api';

const EMPTY_HISTOGRAM = Array(20).fill(0);

const PART_LABELS = [
  'Origin',
  'Key Players',
  'The Case For',
  'The Case Against',
  'Consequences',
  'Where We Stand',
];

function ActionRow({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={18} color={Colors.PRIMARY} />
      <Text style={styles.actionLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.OUTLINE} />
    </TouchableOpacity>
  );
}

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [distribution, setDistribution] = useState<VoteDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [votePosition, setVotePosition] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [allWatched, setAllWatched] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getTopic(id),
      api.getVoteDistribution(id),
    ]).then(([t, d]) => {
      setTopic(t);
      setDistribution(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) setAllWatched(isAllWatched(id));
    }, [id])
  );

  async function castVote(position: number) {
    if (!id || voting) return;
    setVoting(true);
    setVotePosition(position);
    try {
      const updated = await api.submitVote(id, position);
      setDistribution(updated);
    } catch {
      // Keep optimistic position shown
    } finally {
      setVoting(false);
    }
  }

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
          <Text style={styles.errorText}>Topic not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const histogram = distribution?.histogram ?? EMPTY_HISTOGRAM;
  const total = distribution?.total ?? 0;
  const mean = distribution?.mean ?? null;

  const pipelineComplete = topic.pipeline_status?.video === 'complete';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>Verdict</Text>
        <View style={{ width: 30 }} />
      </View>
      <ProgressBar percent={pipelineComplete ? 100 : 50} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <VeracityBadge label="Veracity Confirmed" />
          {topic.briefing && (
            <Text style={styles.category}>• Debate Analysis</Text>
          )}
        </View>

        <Text style={styles.topicTitle}>{topic.topic}</Text>

        {/* Bento: vote count + total */}
        <View style={styles.bentoRow}>
          <View style={[styles.card, styles.cardPrimary]}>
            <Text style={styles.bigNumber}>{total.toLocaleString()}</Text>
            <Text style={styles.bigNumberLabel}>votes cast</Text>
            {mean !== null && (
              <Text style={styles.bigNumberMeta}>
                Mean position: {(mean * 100).toFixed(0)}% toward {topic.pole_b}
              </Text>
            )}
          </View>
          <View style={[styles.card, styles.cardSecondary]}>
            <Text style={styles.totalLabel}>Your Vote</Text>
            {votePosition !== null ? (
              <Text style={styles.totalNumber}>
                {(votePosition * 100).toFixed(0)}%
              </Text>
            ) : (
              <Text style={styles.voteHint}>Tap spectrum below</Text>
            )}
          </View>
        </View>

        {/* Vote spectrum — gated until all 6 videos watched */}
        {allWatched ? (
          <View style={[styles.card, styles.cardFull]}>
            <View style={styles.spectrumHeader}>
              <View>
                <Text style={styles.sectionTitle}>Cast Your Vote</Text>
                <Text style={styles.sectionSubtitle}>
                  Where do you stand? Tap the spectrum to vote.
                </Text>
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.PRIMARY }]} />
                  <Text style={styles.legendLabel}>Your vote</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.SURFACE_CONTAINER_HIGHEST }]} />
                  <Text style={styles.legendLabel}>Global</Text>
                </View>
              </View>
            </View>
            <SpectrumChart
              histogram={histogram}
              userPosition={votePosition}
              poleA={topic.pole_a}
              poleB={topic.pole_b}
            />
            <View style={styles.voteRow}>
              <Text style={styles.poleLabel} numberOfLines={1}>{topic.pole_a}</Text>
              <View style={styles.voteSliderTrack}>
                {Array.from({ length: 10 }, (_, i) => {
                  const position = (i + 0.5) / 10;
                  const isSelected = votePosition !== null && Math.abs(votePosition - position) < 0.06;
                  return (
                    <Pressable
                      key={i}
                      style={[styles.voteSegment, isSelected && styles.voteSegmentSelected]}
                      onPress={() => castVote(position)}
                      disabled={voting}
                    />
                  );
                })}
              </View>
              <Text style={styles.poleLabel} numberOfLines={1}>{topic.pole_b}</Text>
            </View>
            {voting && <ActivityIndicator color={Colors.PRIMARY} style={{ marginTop: 8 }} />}
          </View>
        ) : (
          <View style={[styles.card, styles.voteLockCard]}>
            <MaterialCommunityIcons name="lock-outline" size={28} color={Colors.OUTLINE} />
            <Text style={styles.voteLockTitle}>Voting Locked</Text>
            <Text style={styles.voteLockSubtitle}>
              Watch all 6 parts of the video series to unlock voting.
            </Text>
            <TouchableOpacity
              style={styles.watchSeriesBtn}
              activeOpacity={0.85}
              onPress={() => router.push(`/series/${id}`)}
            >
              <MaterialCommunityIcons name="play-circle-outline" size={16} color={Colors.ON_PRIMARY} />
              <Text style={styles.watchSeriesText}>Watch Series</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Briefing summary */}
        {topic.briefing && (
          <View style={styles.editorialCard}>
            <Text style={styles.editorialTag}>Research Summary</Text>
            <Text style={styles.editorialQuote}>{topic.briefing.current_state}</Text>
          </View>
        )}

        {/* Debate summary */}
        {topic.debate_summary && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Debate Summary</Text>
            <Text style={styles.sideLabel}>{topic.pole_a}</Text>
            {topic.debate_summary.side_a_points.map((pt, i) => (
              <Text key={i} style={styles.bulletPoint}>• {pt}</Text>
            ))}
            <View style={styles.actionDivider} />
            <Text style={styles.sideLabel}>{topic.pole_b}</Text>
            {topic.debate_summary.side_b_points.map((pt, i) => (
              <Text key={i} style={styles.bulletPoint}>• {pt}</Text>
            ))}
          </View>
        )}

        {/* Action rows */}
        <View style={styles.actionsCard}>
          <ActionRow
            icon="play-circle"
            label="Watch Full Series"
            onPress={() => router.push(`/series/${id}`)}
          />
          <View style={styles.actionDivider} />
          <ActionRow
            icon="flask-outline"
            label="View Research"
            onPress={() => router.push(`/deep-dive/${id}`)}
          />
        </View>
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
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.PRIMARY,
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
  scrollContent: { padding: 20, paddingBottom: 120, gap: 20 },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  category: {
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

  bentoRow: { flexDirection: 'row', gap: 12 },
  card: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardPrimary: { flex: 2 },
  cardSecondary: { flex: 1, backgroundColor: Colors.SURFACE_CONTAINER_LOW },
  cardFull: { gap: 16 },

  bigNumber: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 40,
    lineHeight: 44,
    color: Colors.PRIMARY,
    letterSpacing: -1,
  },
  bigNumberLabel: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: Colors.ON_SURFACE,
    marginTop: 4,
  },
  bigNumberMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: Colors.OUTLINE,
    marginTop: 8,
  },
  totalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.OUTLINE,
  },
  totalNumber: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    color: Colors.ON_SURFACE,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  voteHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.OUTLINE,
    marginTop: 8,
    lineHeight: 16,
  },

  spectrumHeader: { gap: 12 },
  sectionTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 18,
    color: Colors.ON_SURFACE,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: Colors.OUTLINE,
    marginTop: 2,
  },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
  },
  legendLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.OUTLINE,
  },

  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  poleLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.ON_SURFACE,
    maxWidth: 60,
  },
  voteSliderTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    gap: 1,
  },
  voteSegment: {
    flex: 1,
    backgroundColor: Colors.SURFACE_CONTAINER,
  },
  voteSegmentSelected: {
    backgroundColor: Colors.PRIMARY,
  },

  voteLockCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  voteLockTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.ON_SURFACE,
    letterSpacing: -0.2,
  },
  voteLockSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.OUTLINE,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  watchSeriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: Colors.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  watchSeriesText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.ON_PRIMARY,
    letterSpacing: 0.2,
  },

  editorialCard: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    gap: 10,
  },
  editorialTag: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
  },
  editorialQuote: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: Colors.ON_SURFACE_VARIANT,
    fontStyle: 'italic',
  },

  sideLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
    marginBottom: 6,
  },
  bulletPoint: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ON_SURFACE_VARIANT,
    marginBottom: 4,
  },

  actionsCard: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.ON_SURFACE,
  },
  actionDivider: {
    height: 1,
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
    marginHorizontal: 20,
  },
});
