import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import PlaceholderImage from '../components/PlaceholderImage';
import VeracityBadge from '../components/VeracityBadge';

function ProgressSegments({ total, filled }: { total: number; filled: number }) {
  return (
    <View style={styles.segments}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { backgroundColor: i < filled ? Colors.PRIMARY_FIXED : 'rgba(255,255,255,0.3)' },
          ]}
        />
      ))}
    </View>
  );
}

export default function ForYouScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent />

      {/* Full-screen green placeholder */}
      <PlaceholderImage style={StyleSheet.absoluteFillObject} />

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.1)',
          'transparent',
          'rgba(0,0,0,0.15)',
          'rgba(0,0,0,0.75)',
        ]}
        locations={[0, 0.15, 0.4, 0.65, 1.0]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Content overlay */}
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 },
        ]}
      >
        {/* Top section */}
        <View style={styles.topSection}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>AI Ethics · Short 2 of 6</Text>
            <MaterialCommunityIcons
              name="check-decagram"
              size={14}
              color={Colors.PRIMARY_FIXED}
              style={{ marginLeft: 6 }}
            />
          </View>
        </View>

        {/* Bottom section */}
        <View style={styles.bottomSection}>
          <VeracityBadge label="Veracity Verified" dark />

          <Text style={styles.headline}>
            The Alignment Problem: Who Defines AGI Values?
          </Text>
          <Text style={styles.body} numberOfLines={3}>
            As we approach artificial general intelligence, the question of whose values will be encoded into these systems becomes one of the most consequential decisions in human history.
          </Text>

          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progress: 2 of 6 watched</Text>
              <Text style={styles.progressPercent}>33% Complete</Text>
            </View>
            <ProgressSegments total={6} filled={2} />
          </View>

          <TouchableOpacity style={styles.watchBtn} activeOpacity={0.88}>
            <Text style={styles.watchBtnLabel}>Watch Full Series</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },

  topSection: {
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  metaChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  bottomSection: {
    gap: 14,
  },
  headline: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 26,
    lineHeight: 32,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.8)',
  },

  progressSection: { gap: 8 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  progressPercent: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.PRIMARY_FIXED,
  },
  segments: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },

  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 15,
    gap: 8,
  },
  watchBtnLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
