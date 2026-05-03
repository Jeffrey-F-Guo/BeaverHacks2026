import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import VeracityBadge from '../../src/components/VeracityBadge';
import ProgressBar from '../../src/components/ProgressBar';
import { api, Topic, PipelineStatus } from '../../src/services/api';

const STAGE_LABELS: { key: keyof PipelineStatus; label: string }[] = [
  { key: 'research', label: 'Deep research and source cross-referencing…' },
  { key: 'debate', label: 'Adversarial debate between AI agents…' },
  { key: 'summary', label: 'Synthesizing debate into key findings…' },
  { key: 'scripts', label: 'Writing 6-part video scripts…' },
  { key: 'audio', label: 'Generating narration audio…' },
  { key: 'video', label: 'Assembling final video series…' },
];

const PART_ROLES = [
  { num: '01', title: 'Origin', key: 'research' },
  { num: '02', title: 'Key Players', key: 'research' },
  { num: '03', title: 'The Case For', key: 'scripts' },
  { num: '04', title: 'The Case Against', key: 'scripts' },
  { num: '05', title: 'Consequences', key: 'audio' },
  { num: '06', title: 'Where We Stand', key: 'video' },
];

function PulsingDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.85, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.pulseDot, { transform: [{ scale }] }]} />;
}

function SpinnerIcon() {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 1000, useNativeDriver: true })
    ).start();
  }, []);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <MaterialCommunityIcons name="loading" size={20} color={Colors.PRIMARY} />
    </Animated.View>
  );
}

function stageState(status: PipelineStatus | null, key: keyof PipelineStatus): 'done' | 'active' | 'pending' {
  if (!status) return 'pending';
  const v = status[key];
  if (v === 'complete') return 'done';
  if (v === 'running') return 'active';
  return 'pending';
}

function partState(status: PipelineStatus | null, stageKey: string): 'done' | 'active' | 'locked' {
  if (!status) return 'locked';
  const v = (status as any)[stageKey];
  if (v === 'complete') return 'done';
  if (v === 'running') return 'active';
  return 'locked';
}

function StatusStep({ label, state }: { label: string; state: 'done' | 'active' | 'pending' }) {
  return (
    <View style={styles.step}>
      {state === 'done' && (
        <View style={styles.stepDone}>
          <MaterialCommunityIcons name="check" size={13} color="#fff" />
        </View>
      )}
      {state === 'active' && <PulsingDot />}
      {state === 'pending' && <View style={styles.stepPending} />}
      <Text style={[styles.stepLabel, state === 'active' && styles.stepLabelActive, state === 'pending' && styles.stepLabelPending]}>
        {label}
      </Text>
    </View>
  );
}

export default function ResearchScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CARD_WIDTH = (SCREEN_WIDTH - 40 - 24) / 3;

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTopics().then((data) => {
      setTopics(data);
      if (data.length > 0) setSelectedTopic(data[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Poll pipeline status every 5s while any stage is not complete
  useEffect(() => {
    if (!selectedTopic) return;
    const status = selectedTopic.pipeline_status;
    const allDone = status && Object.values(status).every((v) => v === 'complete');
    if (allDone) return;
    const interval = setInterval(async () => {
      try {
        const updated = await api.getPipelineStatus(selectedTopic.id);
        setSelectedTopic((prev) => prev ? { ...prev, pipeline_status: updated } : prev);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedTopic?.id, selectedTopic?.pipeline_status]);

  const status = selectedTopic?.pipeline_status ?? null;
  const videoComplete = status?.video === 'complete';
  const doneCount = status ? Object.values(status).filter((v) => v === 'complete').length : 0;
  const progressPercent = Math.round((doneCount / 6) * 100);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>GroundTruth</Text>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="account-circle" size={28} color={Colors.OUTLINE} />
        </View>
      </View>
      <ProgressBar percent={progressPercent} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      ) : !selectedTopic ? (
        <View style={styles.loader}>
          <Text style={styles.emptyText}>No topics available.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Topic picker */}
          {topics.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {topics.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerChip, selectedTopic.id === t.id && styles.pickerChipActive]}
                  onPress={() => setSelectedTopic(t)}
                >
                  <Text style={[styles.pickerChipText, selectedTopic.id === t.id && styles.pickerChipTextActive]} numberOfLines={1}>
                    {t.topic}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.heroSection}>
            <VeracityBadge label={videoComplete ? 'Research Complete' : 'Deep Research Protocol Active'} />
            <Text style={styles.heroTitle}>{selectedTopic.topic}</Text>
            <Text style={styles.heroDesc}>
              Our synthesis engine is cross-referencing sources, mapping stakeholder positions, and building the evidence base for both sides of this debate.
            </Text>
          </View>

          {/* Status Feed */}
          <View style={styles.statusCard}>
            <Text style={styles.cardSectionTitle}>Research Status</Text>
            <View style={styles.stepsList}>
              {STAGE_LABELS.map(({ key, label }) => (
                <StatusStep key={key} label={label} state={stageState(status, key)} />
              ))}
            </View>
          </View>

          {/* 6-Part Investigation Grid */}
          <View>
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>6-Part Investigation</Text>
              {!videoComplete && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              )}
            </View>
            <View style={styles.invGrid}>
              {PART_ROLES.map((part) => {
                const state = partState(status, part.key);
                return (
                  <View
                    key={part.num}
                    style={[
                      styles.invCard,
                      { width: CARD_WIDTH },
                      state === 'active' && styles.invCardActive,
                      state === 'locked' && styles.invCardLocked,
                    ]}
                  >
                    {state === 'done' && (
                      <MaterialCommunityIcons name="check-circle" size={18} color={Colors.PRIMARY} />
                    )}
                    {state === 'active' && <SpinnerIcon />}
                    {state === 'locked' && (
                      <MaterialCommunityIcons name="lock" size={18} color={Colors.OUTLINE} />
                    )}
                    <Text style={[styles.invNum, state === 'locked' && styles.invTextFaded]}>
                      Part {part.num}
                    </Text>
                    <Text style={[styles.invTitle, state === 'locked' && styles.invTextFaded]} numberOfLines={2}>
                      {part.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: 16,
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
  headerIcon: { padding: 2 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 16,
    color: Colors.OUTLINE,
  },
  scroll: { flex: 1, backgroundColor: Colors.SURFACE },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 24 },

  pickerRow: { gap: 8, paddingBottom: 4 },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: Colors.SURFACE_CONTAINER,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    maxWidth: 200,
  },
  pickerChipActive: {
    backgroundColor: Colors.PRIMARY,
    borderColor: Colors.PRIMARY,
  },
  pickerChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.ON_SURFACE,
  },
  pickerChipTextActive: { color: '#fff' },

  heroSection: { alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 8 },
  heroTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    color: Colors.ON_SURFACE,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroDesc: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ON_SURFACE_VARIANT,
    textAlign: 'center',
  },

  statusCard: {
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
    gap: 16,
  },
  cardSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.OUTLINE,
  },
  stepsList: { gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.PRIMARY_FIXED,
    borderWidth: 3,
    borderColor: Colors.PRIMARY,
  },
  stepPending: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.OUTLINE_VARIANT,
    backgroundColor: 'transparent',
  },
  stepLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.ON_SURFACE,
    flex: 1,
  },
  stepLabelActive: { fontFamily: 'Inter_600SemiBold', color: Colors.PRIMARY },
  stepLabelPending: { color: Colors.OUTLINE, opacity: 0.6 },

  gridHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  gridTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.ON_SURFACE,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(13, 99, 27, 0.08)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.PRIMARY },
  liveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.PRIMARY,
    letterSpacing: 0.5,
  },

  invGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  invCard: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    padding: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  invCardActive: { borderColor: Colors.PRIMARY, borderWidth: 1.5 },
  invCardLocked: { backgroundColor: Colors.SURFACE_CONTAINER_LOW, opacity: 0.65 },
  invNum: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.OUTLINE,
    marginTop: 2,
  },
  invTitle: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 13,
    lineHeight: 17,
    color: Colors.ON_SURFACE,
  },
  invTextFaded: { color: Colors.OUTLINE },
});
