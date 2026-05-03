import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  percent: number;
}

export default function ProgressBar({ percent }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { flex: clamped }]} />
      <View style={{ flex: 100 - clamped }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    flexDirection: 'row',
    backgroundColor: Colors.SURFACE_CONTAINER_HIGH,
  },
  fill: {
    height: 2,
    backgroundColor: Colors.PRIMARY,
  },
});
