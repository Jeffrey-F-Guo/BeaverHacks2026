import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface Props {
  label: string;
  dark?: boolean;
}

export default function VeracityBadge({ label, dark }: Props) {
  return (
    <View style={[styles.badge, dark && styles.badgeDark]}>
      <MaterialCommunityIcons
        name="check-decagram"
        size={14}
        color={dark ? Colors.PRIMARY_FIXED : Colors.PRIMARY}
        style={{ marginRight: 4 }}
      />
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 99, 27, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13, 99, 27, 0.2)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  badgeDark: {
    backgroundColor: 'rgba(163, 246, 156, 0.15)',
    borderColor: 'rgba(163, 246, 156, 0.3)',
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.PRIMARY,
  },
  labelDark: {
    color: Colors.PRIMARY_FIXED,
  },
});
