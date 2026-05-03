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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import VeracityBadge from '../components/VeracityBadge';
import ProgressBar from '../components/ProgressBar';
import PlaceholderImage from '../components/PlaceholderImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 24) / 3;
const CARD_IMAGE_HEIGHT = CARD_WIDTH * 0.75;

const VIDEO_PARTS = [
  { num: '01', title: 'Origin', state: 'ready' as const },
  { num: '02', title: 'Key Players', state: 'ready' as const },
  { num: '03', title: 'The Case For', state: 'generating' as const },
  { num: '04', title: 'The Case Against', state: 'locked' as const },
  { num: '05', title: 'Consequences', state: 'locked' as const },
  { num: '06', title: 'Where We Stand', state: 'locked' as const },
];

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
      <MaterialCommunityIcons name="loading" size={18} color={Colors.PRIMARY} />
    </Animated.View>
  );
}

function ShimmerBar() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true })
    ).start();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_WIDTH * 2, CARD_WIDTH * 2],
  });

  return (
    <View style={styles.shimmerTrack}>
      <View style={styles.shimmerFill}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={styles.shimmerRemainder} />
    </View>
  );
}

function VideoCard({ num, title, state }: (typeof VIDEO_PARTS)[0]) {
  return (
    <View
      style={[
        styles.videoCard,
        state === 'locked' && styles.videoCardLocked,
      ]}
    >
      <View style={{ height: CARD_IMAGE_HEIGHT, position: 'relative', overflow: 'hidden' }}>
        {state === 'ready' && (
          <>
            <PlaceholderImage style={StyleSheet.absoluteFillObject} />
            <View style={styles.playOverlay}>
              <View style={styles.playCircle}>
                <MaterialCommunityIcons name="play" size={14} color="#fff" />
              </View>
            </View>
            <View style={styles.checkBadge}>
              <MaterialCommunityIcons name="check-circle" size={16} color={Colors.PRIMARY} />
            </View>
          </>
        )}
        {state === 'generating' && (
          <View style={[styles.generatingBg, { height: CARD_IMAGE_HEIGHT }]}>
            <SpinnerIcon />
            <Text style={styles.synthesizingText}>Synthesizing...</Text>
          </View>
        )}
        {state === 'locked' && (
          <View style={[styles.lockedBg, { height: CARD_IMAGE_HEIGHT }]}>
            <MaterialCommunityIcons name="lock" size={20} color={Colors.OUTLINE} />
          </View>
        )}
      </View>
      <View style={styles.videoCardBody}>
        <Text style={[styles.videoPartNum, state === 'locked' && styles.fadedText]}>
          Part {num}
        </Text>
        <Text
          style={[styles.videoTitle, state === 'locked' && styles.fadedText]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {state === 'generating' && <ShimmerBar />}
      </View>
    </View>
  );
}

export default function VideoCreationScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialCommunityIcons name="menu" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>GroundTruth</Text>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="account-circle" size={26} color={Colors.OUTLINE} />
        </View>
      </View>
      <ProgressBar percent={67} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <VeracityBadge label="Veracity Series" />
          <Text style={styles.heroTitle}>The AGI Safety Threshold</Text>
          <Text style={styles.heroDesc}>
            Creating your 6-part video series from the AI debate. Each part is synthesized from verified sources.
          </Text>
        </View>

        {/* Video Grid */}
        <View style={styles.videoGrid}>
          {VIDEO_PARTS.map((part) => (
            <VideoCard key={part.num} {...part} />
          ))}
        </View>

        {/* CTA Card */}
        <View style={styles.ctaCard}>
          <View style={styles.bellCircle}>
            <MaterialCommunityIcons name="bell" size={20} color={Colors.PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Stay updated</Text>
            <Text style={styles.ctaDesc}>
              We'll notify you the moment your full series is ready to watch.
            </Text>
          </View>
          <TouchableOpacity style={styles.notifyBtn} activeOpacity={0.85}>
            <Text style={styles.notifyBtnLabel}>Notify Me</Text>
          </TouchableOpacity>
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
  headerIcon: { padding: 4, width: 32 },
  scroll: { flex: 1, backgroundColor: Colors.SURFACE },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 24 },

  heroSection: { alignItems: 'center', gap: 10, paddingTop: 8 },
  heroTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    color: Colors.ON_SURFACE,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  heroDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: Colors.ON_SURFACE_VARIANT,
    textAlign: 'center',
  },

  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  videoCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  videoCardLocked: {
    opacity: 0.65,
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  generatingBg: {
    backgroundColor: Colors.SURFACE_DIM,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  synthesizingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: Colors.PRIMARY,
    letterSpacing: 0.3,
  },
  lockedBg: {
    backgroundColor: Colors.SURFACE_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoCardBody: { padding: 8, gap: 3 },
  videoPartNum: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.OUTLINE,
  },
  videoTitle: {
    fontFamily: 'Newsreader_500Medium',
    fontSize: 11,
    lineHeight: 15,
    color: Colors.ON_SURFACE,
  },
  fadedText: { color: Colors.OUTLINE },

  shimmerTrack: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: Colors.SURFACE_CONTAINER_HIGH,
    marginTop: 4,
  },
  shimmerFill: {
    flex: 3,
    backgroundColor: Colors.PRIMARY_CONTAINER,
    overflow: 'hidden',
  },
  shimmerRemainder: {
    flex: 1,
    backgroundColor: Colors.SURFACE_CONTAINER_HIGH,
  },

  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  bellCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(13, 99, 27, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.ON_SURFACE,
  },
  ctaDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: Colors.OUTLINE,
    marginTop: 2,
  },
  notifyBtn: {
    backgroundColor: Colors.PRIMARY,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  notifyBtnLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
});
