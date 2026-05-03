import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '../theme/colors';

const TABS = [
  { name: 'Topics', icon: 'home-variant' as const, label: 'Topics' },
  { name: 'ForYou', icon: 'play-circle' as const, label: 'For You' },
  { name: 'Research', icon: 'flask-outline' as const, label: 'Research' },
  { name: 'Videos', icon: 'film' as const, label: 'Videos' },
  { name: 'Vote', icon: 'chart-bar' as const, label: 'Vote' },
];

export default function BottomNavBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab, index) => {
        const isActive = state.index === index;
        const color = isActive ? Colors.PRIMARY : '#9ca3af';

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name={tab.icon} size={22} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderTopWidth: 1,
    borderTopColor: Colors.SURFACE_CONTAINER_LOW,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 8,
    gap: 3,
    borderTopWidth: 2,
    borderTopColor: 'transparent',
  },
  tabActive: {
    borderTopColor: Colors.PRIMARY,
  },
  tabLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
