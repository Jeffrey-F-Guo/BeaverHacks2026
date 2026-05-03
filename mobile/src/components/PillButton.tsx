import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface Props {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function PillButton({ label, onPress, style, fullWidth }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, fullWidth && styles.fullWidth, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.label}>{label}</Text>
      <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.PRIMARY,
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 13,
    gap: 6,
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.26,
  },
});
