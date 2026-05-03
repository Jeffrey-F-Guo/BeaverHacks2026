import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import VeracityBadge from '../components/VeracityBadge';
import ProgressBar from '../components/ProgressBar';
import PillButton from '../components/PillButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BAR_DATA = [
  { height: 0.12 }, { height: 0.22 }, { height: 0.38 }, { height: 0.55 },
  { height: 0.72 }, { height: 0.95, isUser: true }, { height: 0.82 },
  { height: 0.60 }, { height: 0.42 }, { height: 0.28 }, { height: 0.18 },
  { height: 0.10 }, { height: 0.06 },
];

const CHART_HEIGHT = 140;

function ConsensusChart() {
  return (
    <View style={styles.chartContainer}>
      {BAR_DATA.map((bar, i) => {
        const barHeight = bar.height * CHART_HEIGHT;
        return (
          <View key={i} style={styles.barWrapper}>
            {bar.isUser && (
              <Text style={styles.youLabel}>YOU</Text>
            )}
            <View
              style={[
                styles.bar,
                {
                  height: barHeight,
                  backgroundColor: bar.isUser ? Colors.PRIMARY : Colors.SURFACE_CONTAINER_HIGHEST,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function ActionRow({ icon, label }: { icon: any; label: string }) {
  return (
    <TouchableOpacity style={styles.actionRow} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon} size={18} color={Colors.PRIMARY} />
      <Text style={styles.actionLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.OUTLINE} />
    </TouchableOpacity>
  );
}

export default function VoteScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>GroundTruth</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
      </View>
      <ProgressBar percent={67} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <VeracityBadge label="Veracity Confirmed" />
          <Text style={styles.category}>• Policy Analysis</Text>
        </View>

        <Text style={styles.topicTitle}>
          The Impact of Urban Green Space on Community Mental Health in High-Density Districts
        </Text>

        {/* Bento Grid */}
        <View style={styles.bentoRow}>
          <View style={[styles.card, styles.cardPrimary]}>
            <Text style={styles.bigNumber}>12,482</Text>
            <Text style={styles.bigNumberLabel}>people see it the way you do</Text>
            <Text style={styles.bigNumberMeta}>
              Your perspective aligns with the 'Integrated Environmentalist' cluster across 12,482 participants.
            </Text>
          </View>
          <View style={[styles.card, styles.cardSecondary]}>
            <Text style={styles.totalLabel}>TOTAL PARTICIPATION</Text>
            <Text style={styles.totalNumber}>48,902</Text>
            <View style={styles.percentileRow}>
              <MaterialCommunityIcons name="account-group" size={12} color={Colors.PRIMARY} />
              <Text style={styles.percentileText}>98th Percentile Engagement</Text>
            </View>
            <PillButton label="Invite" style={{ marginTop: 12 }} />
          </View>
        </View>

        {/* Consensus Spectrum */}
        <View style={[styles.card, styles.cardFull]}>
          <View style={styles.spectrumHeader}>
            <View>
              <Text style={styles.sectionTitle}>Consensus Spectrum</Text>
              <Text style={styles.sectionSubtitle}>
                Distribution of perspectives across the socio-economic impact scale
              </Text>
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.PRIMARY }]} />
                <Text style={styles.legendLabel}>Aligned</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.SURFACE_CONTAINER_HIGHEST }]} />
                <Text style={styles.legendLabel}>Global</Text>
              </View>
            </View>
          </View>
          <ConsensusChart />
          <View style={styles.xAxis}>
            <Text style={styles.xAxisLabel}>Skeptical</Text>
            <Text style={styles.xAxisLabel}>Neutral</Text>
            <Text style={styles.xAxisLabel}>High Agreement</Text>
          </View>
        </View>

        {/* Editorial Note */}
        <View style={styles.editorialCard}>
          <Text style={styles.editorialTag}>Editorial Note</Text>
          <Text style={styles.editorialQuote}>
            "The convergence around urban greening policies suggests a rare cross-partisan consensus — one that urban planners and policymakers would be unwise to ignore."
          </Text>
          <Text style={styles.editorialAttrib}>— Elena Vance, Senior Analyst</Text>
        </View>

        {/* Action Rows */}
        <View style={styles.actionsCard}>
          <ActionRow icon="download" label="Download Full Dataset" />
          <View style={styles.actionDivider} />
          <ActionRow icon="book-open-variant" label="View Methodology" />
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
  headerIcon: { padding: 4 },
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
  percentileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  percentileText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.PRIMARY,
    flexShrink: 1,
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

  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 3,
    paddingHorizontal: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  youLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: Colors.PRIMARY,
    letterSpacing: 0.5,
    marginBottom: 3,
  },

  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  xAxisLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.OUTLINE,
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
  editorialAttrib: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.OUTLINE,
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
