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
import ProgressBar from '../../src/components/ProgressBar';
import SpectrumChart from '../../src/components/SpectrumChart';
import { api, TopicDetail, VoteDistribution } from '../../src/services/api';

const EMPTY_HISTOGRAM = Array(10).fill(0);

function downsample(hist: number[], bins: number): number[] {
  const factor = hist.length / bins;
  return Array.from({ length: bins }, (_, i) => {
    const start = Math.floor(i * factor);
    const end = Math.floor((i + 1) * factor);
    return hist.slice(start, end).reduce((a, b) => a + b, 0);
  });
}
const VOTE_RED = '#b05050';
const VOTE_BLUE = '#4060b0';
const VOTE_RED_LIGHT = '#f2dede';
const VOTE_BLUE_LIGHT = '#dae0f2';

const PART_LABELS = [
  'Origin',
  'Key Players',
  'The Case For',
  'The Case Against',
  'Consequences',
  'Where We Stand',
];


export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [distribution, setDistribution] = useState<VoteDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [votePosition, setVotePosition] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [allWatched, setAllWatched] = useState(false);
  const [debateExpanded, setDebateExpanded] = useState(false);
  const [sideAExpanded, setSideAExpanded] = useState(false);
  const [sideBExpanded, setSideBExpanded] = useState(false);
  const [researchExpanded, setResearchExpanded] = useState(false);

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

  const histogram = downsample(distribution?.histogram ?? EMPTY_HISTOGRAM, 10);
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
        <Text style={styles.topicTitle}>{topic.topic}</Text>

        {/* Bento: vote count + total */}
        <View style={styles.bentoRow}>
          <View style={[styles.card, styles.cardPrimary]}>
            <Text style={styles.bigNumber}>{total.toLocaleString()}</Text>
            <Text style={styles.bigNumberLabel}>votes cast</Text>
          </View>
          <View style={[styles.card, styles.cardSecondary]}>
            <Text style={styles.totalLabel}>Consensus</Text>
            {mean === null || total === 0 ? (
              <Text style={styles.voteHint}>No votes yet</Text>
            ) : mean < 0.45 ? (
              <Text style={[styles.consensusLabel, { color: VOTE_RED }]} numberOfLines={5}>
                {topic.pole_a}
              </Text>
            ) : mean > 0.55 ? (
              <Text style={[styles.consensusLabel, { color: VOTE_BLUE }]} numberOfLines={5}>
                {topic.pole_b}
              </Text>
            ) : (
              <Text style={[styles.consensusLabel, { color: Colors.OUTLINE }]}>Split</Text>
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
            <View style={styles.voteSliderTrack}>
              {Array.from({ length: 10 }, (_, i) => {
                const position = (i + 0.5) / 10;
                const isSelected = votePosition !== null && Math.abs(votePosition - position) < 0.06;
                const isRed = i < 5;
                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.voteSegment,
                      { backgroundColor: isRed ? VOTE_RED_LIGHT : VOTE_BLUE_LIGHT },
                      isSelected && { backgroundColor: isRed ? VOTE_RED : VOTE_BLUE },
                    ]}
                    onPress={() => castVote(position)}
                    disabled={voting}
                  />
                );
              })}
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

        {/* Debate summary */}
        {topic.debate_summary && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              activeOpacity={0.7}
              onPress={() => setDebateExpanded((v) => !v)}
            >
              <Text style={styles.sectionTitle}>Debate Summary</Text>
              <MaterialCommunityIcons
                name={debateExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.OUTLINE}
              />
            </TouchableOpacity>
            {debateExpanded && (
              <View style={styles.collapsibleBody}>
                <TouchableOpacity
                  style={styles.sideLabelRow}
                  activeOpacity={0.7}
                  onPress={() => setSideAExpanded((v) => !v)}
                >
                  <Text style={[styles.sideLabel, { color: VOTE_RED }]}>{topic.pole_a}</Text>
                  <MaterialCommunityIcons
                    name={sideAExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={VOTE_RED}
                  />
                </TouchableOpacity>
                {sideAExpanded && (
                  <View style={styles.bulletBlock}>
                    {topic.debate_summary.side_a_points.map((pt, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletPoint}>{pt}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.actionDivider} />
                <TouchableOpacity
                  style={styles.sideLabelRow}
                  activeOpacity={0.7}
                  onPress={() => setSideBExpanded((v) => !v)}
                >
                  <Text style={[styles.sideLabel, { color: VOTE_BLUE }]}>{topic.pole_b}</Text>
                  <MaterialCommunityIcons
                    name={sideBExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={VOTE_BLUE}
                  />
                </TouchableOpacity>
                {sideBExpanded && (
                  <View style={styles.bulletBlock}>
                    {topic.debate_summary.side_b_points.map((pt, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletPoint}>{pt}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Research summary */}
        {topic.briefing && (
          <View style={styles.editorialCard}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              activeOpacity={0.7}
              onPress={() => setResearchExpanded((v) => !v)}
            >
              <Text style={styles.editorialTag}>Research Summary</Text>
              <MaterialCommunityIcons
                name={researchExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.OUTLINE}
              />
            </TouchableOpacity>
            {researchExpanded && (
              <Text style={[styles.editorialQuote, { marginTop: 10 }]}>
                {topic.briefing.current_state}
              </Text>
            )}
          </View>
        )}

        {/* Action tiles */}
        <View style={styles.actionTileRow}>
          <TouchableOpacity
            style={[styles.actionTile, { backgroundColor: Colors.PRIMARY }]}
            activeOpacity={0.85}
            onPress={() => router.push(`/series/${id}`)}
          >
            <MaterialCommunityIcons name="play-circle" size={32} color={Colors.ON_PRIMARY} />
            <Text style={[styles.actionTileLabel, { color: Colors.ON_PRIMARY }]}>Watch{'\n'}Full Series</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionTile, { backgroundColor: Colors.SURFACE_CONTAINER_LOWEST, borderWidth: 1, borderColor: Colors.SURFACE_CONTAINER_HIGH }]}
            activeOpacity={0.85}
            onPress={() => router.push(`/deep-dive/${id}`)}
          >
            <MaterialCommunityIcons name="flask-outline" size={32} color={Colors.PRIMARY} />
            <Text style={[styles.actionTileLabel, { color: Colors.ON_SURFACE }]}>View{'\n'}Deep Dive</Text>
          </TouchableOpacity>
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
  cardPrimary: { width: 120, aspectRatio: 1 },
  cardSecondary: { flex: 1, backgroundColor: Colors.SURFACE_CONTAINER_LOW },
  cardFull: { gap: 16 },

  bigNumber: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 30,
    lineHeight: 34,
    color: Colors.ON_SURFACE,
    letterSpacing: -0.5,
  },
  bigNumberLabel: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: Colors.ON_SURFACE,
    marginTop: 4,
  },
  totalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.OUTLINE,
  },
  consensusLabel: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
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
    fontSize: 20,
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

  poleLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  poleLabel: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  voteSliderTrack: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
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
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.ON_SURFACE,
  },
  editorialQuote: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: Colors.ON_SURFACE_VARIANT,
    fontStyle: 'italic',
  },

  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleBody: {
    marginTop: 12,
    gap: 0,
  },

  sideLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sideLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  bulletBlock: {
    marginLeft: 16,
    marginBottom: 4,
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: Colors.OUTLINE,
  },
  bulletPoint: {
    flex: 1,
    fontFamily: 'Newsreader_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ON_SURFACE_VARIANT,
  },

  actionDivider: {
    height: 1,
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
  },
  actionTileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionTile: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionTileLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
});
