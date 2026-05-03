import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import VeracityBadge from '../components/VeracityBadge';
import ProgressBar from '../components/ProgressBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
  { label: 'Researching historical context…', state: 'done' as const },
  { label: 'Mapping key stakeholders…', state: 'done' as const },
  { label: 'Building the case for both sides…', state: 'active' as const },
  { label: 'Analyzing real-world consequences…', state: 'pending' as const },
];

const PARTS = [
  { num: '01', title: 'Origin', state: 'done' as const },
  { num: '02', title: 'Key Players', state: 'done' as const },
  { num: '03', title: 'The Case For', state: 'active' as const },
  { num: '04', title: 'The Case Against', state: 'locked' as const },
  { num: '05', title: 'Consequences', state: 'locked' as const },
  { num: '06', title: 'Where We Stand', state: 'locked' as const },
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

  return (
    <Animated.View style={[styles.pulseDot, { transform: [{ scale }] }]} />
  );
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
      <Text
        style={[
          styles.stepLabel,
          state === 'active' && styles.stepLabelActive,
          state === 'pending' && styles.stepLabelPending,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const CARD_WIDTH = (SCREEN_WIDTH - 40 - 24) / 3;

function InvestigationCard({
  num,
  title,
  state,
}: (typeof PARTS)[0]) {
  return (
    <View
      style={[
        styles.invCard,
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
        Part {num}
      </Text>
      <Text
        style={[styles.invTitle, state === 'locked' && styles.invTextFaded]}
        numberOfLines={2}
      >
        {title}
      </Text>
    </View>
  );
}

export default function DeepResearchScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialCommunityIcons name="menu" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>GroundTruth</Text>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account-circle" size={28} color={Colors.OUTLINE} />
        </View>
      </View>
      <ProgressBar percent={67} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <VeracityBadge label="Deep Research Protocol Active" />
          <Text style={styles.heroTitle}>The AGI Safety Threshold</Text>
          <Text style={styles.heroDesc}>
            Our synthesis engine is currently cross-referencing 1,200+ sources, mapping stakeholder positions, and building the evidence base for both sides of this debate.
          </Text>
        </View>

        {/* Status Feed */}
        <View style={styles.statusCard}>
          <Text style={styles.cardSectionTitle}>Research Status</Text>
          <View style={styles.stepsList}>
            {STEPS.map((step, i) => (
              <StatusStep key={i} label={step.label} state={step.state} />
            ))}
          </View>
        </View>

        {/* 6-Part Investigation Grid */}
        <View>
          <View style={styles.gridHeader}>
            <Text style={styles.gridTitle}>6-Part Investigation</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>
          <View style={styles.invGrid}>
            {PARTS.map((part) => (
              <InvestigationCard key={part.num} {...part} />
            ))}
          </View>
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
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderBottomWidth: 1,
    borderBottomColor: Colors.SURFACE_CONTAINER_LOW,
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.PRIMARY,
    letterSpacing: -0.3,
  },
  headerIcon: { padding: 4 },
  avatar: { padding: 2 },
  scroll: { flex: 1, backgroundColor: Colors.SURFACE },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 24 },

  heroSection: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  heroTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 32,
    lineHeight: 38,
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
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
  stepLabelActive: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.PRIMARY,
  },
  stepLabelPending: {
    color: Colors.OUTLINE,
    opacity: 0.6,
  },

  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
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
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.PRIMARY,
  },
  liveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.PRIMARY,
    letterSpacing: 0.5,
  },

  invGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  invCard: {
    width: CARD_WIDTH,
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
  invCardActive: {
    borderColor: Colors.PRIMARY,
    borderWidth: 1.5,
  },
  invCardLocked: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOW,
    opacity: 0.65,
  },
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
  invTextFaded: {
    color: Colors.OUTLINE,
  },
});
