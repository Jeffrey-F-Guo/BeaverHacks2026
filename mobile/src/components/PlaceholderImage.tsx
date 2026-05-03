import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  style?: StyleProp<ViewStyle>;
}

export default function PlaceholderImage({ style }: Props) {
  return <View style={[styles.base, style]} />;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.PRIMARY,
  },
});
