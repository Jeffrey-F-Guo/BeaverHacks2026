import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

const CHART_HEIGHT = 140;
const VOTE_RED = '#b05050';
const VOTE_BLUE = '#4060b0';

interface Props {
  histogram: number[];
  userPosition?: number | null;
  poleA: string;
  poleB: string;
}

export default function SpectrumChart({ histogram, userPosition, poleA, poleB }: Props) {
  const max = Math.max(...histogram, 1);
  const userBucket = userPosition != null ? Math.min(Math.floor(userPosition * histogram.length), histogram.length - 1) : -1;

  return (
    <View>
      <View style={styles.chartContainer}>
        {histogram.map((count, i) => {
          const barHeight = (count / max) * CHART_HEIGHT;
          const isUser = i === userBucket;
          const mid = histogram.length / 2;
          const baseColor = i < mid ? VOTE_RED : VOTE_BLUE;
          return (
            <View key={i} style={styles.barWrapper}>
              {isUser && <Text style={styles.youLabel}>YOU</Text>}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(barHeight, 2),
                    backgroundColor: isUser ? Colors.ON_SURFACE : baseColor,
                    opacity: isUser ? 1 : 0.55 + 0.45 * (count / max),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.xAxis}>
        <Text style={[styles.xAxisLabel, { textAlign: 'left', color: VOTE_RED }]} numberOfLines={2}>{poleA}</Text>
        <Text style={[styles.xAxisLabel, { textAlign: 'center', flex: 0, paddingHorizontal: 8 }]}>Neutral</Text>
        <Text style={[styles.xAxisLabel, { textAlign: 'right', color: VOTE_BLUE }]} numberOfLines={2}>{poleB}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: 2,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  youLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: Colors.ON_SURFACE,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  xAxis: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  xAxisLabel: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
    color: Colors.OUTLINE,
  },
});
