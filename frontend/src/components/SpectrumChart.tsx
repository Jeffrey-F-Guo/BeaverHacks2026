import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

const CHART_HEIGHT = 140;

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
          return (
            <View key={i} style={styles.barWrapper}>
              {isUser && <Text style={styles.youLabel}>YOU</Text>}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(barHeight, 2),
                    backgroundColor: isUser ? Colors.PRIMARY : Colors.SURFACE_CONTAINER_HIGHEST,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.xAxis}>
        <Text style={styles.xAxisLabel} numberOfLines={1}>{poleA}</Text>
        <Text style={styles.xAxisLabel}>Neutral</Text>
        <Text style={styles.xAxisLabel} numberOfLines={1}>{poleB}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: '33%',
  },
});
