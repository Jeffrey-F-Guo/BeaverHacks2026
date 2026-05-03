import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import VeracityBadge from '../../src/components/VeracityBadge';
import ProgressBar from '../../src/components/ProgressBar';
import { api, Topic } from '../../src/services/api';

const PART_ROLES = ['Origin', 'Key Players', 'The Case For', 'The Case Against', 'Consequences', 'Where We Stand'];

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

function ShimmerBar({ cardWidth }: { cardWidth: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true })
    ).start();
  }, []);
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-cardWidth * 2, cardWidth * 2],
  });
  return (
    <View style={styles.shimmerTrack}>
      <View style={styles.shimmerFill}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}>
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

export default function VideosScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const CARD_WIDTH = (SCREEN_WIDTH - 40 - 24) / 3;
  const CARD_IMAGE_HEIGHT = CARD_WIDTH * 0.75;
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTopics().then((data) => {
      setTopics(data);
      if (data.length > 0) setSelectedTopic(data[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const topic = selectedTopic;
  const videoReady = topic?.pipeline_status?.video === 'complete';
  const audioReady = topic?.pipeline_status?.audio === 'complete';
  const scriptsReady = topic?.pipeline_status?.scripts === 'complete';

  function videoCardState(index: number): 'ready' | 'generating' | 'locked' {
    if (!topic) return 'locked';
    if (videoReady && topic.video_urls && topic.video_urls[index]) return 'ready';
    if (audioReady) return 'generating';
    if (scriptsReady && index < 2) return 'generating';
    return 'locked';
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Verdict</Text>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="account-circle" size={26} color={Colors.OUTLINE} />
        </View>
      </View>
      <ProgressBar percent={videoReady ? 100 : audioReady ? 80 : scriptsReady ? 50 : 20} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      ) : !topic ? (
        <View style={styles.loader}>
          <Text style={styles.emptyText}>No topics available.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Topic picker */}
          {topics.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickerRow}
            >
              {topics.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerChip, selectedTopic?.id === t.id && styles.pickerChipActive]}
                  onPress={() => setSelectedTopic(t)}
                >
                  <Text style={[styles.pickerChipText, selectedTopic?.id === t.id && styles.pickerChipTextActive]} numberOfLines={1}>
                    {t.topic}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.heroSection}>
            <VeracityBadge label="Veracity Series" />
            <Text style={styles.heroTitle}>{topic.topic}</Text>
            <Text style={styles.heroDesc}>
              Your 6-part video series from the AI debate. Each part synthesized from verified sources.
            </Text>
          </View>

          {/* Video Grid */}
          <View style={styles.videoGrid}>
            {PART_ROLES.map((title, i) => {
              const state = videoCardState(i);
              const videoUrl = topic.video_urls?.[i];
              return (
                <Pressable
                  key={i}
                  style={[styles.videoCard, { width: CARD_WIDTH }, state === 'locked' && styles.videoCardLocked]}
                  onPress={() => {
                    if (state === 'ready' && videoUrl) {
                      router.push(`/topic/${topic.id}`);
                    }
                  }}
                  disabled={state !== 'ready'}
                >
                  <View style={{ height: CARD_IMAGE_HEIGHT, position: 'relative', overflow: 'hidden' }}>
                    {state === 'ready' && (
                      <>
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.PRIMARY_CONTAINER }]} />
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
                      Part {String(i + 1).padStart(2, '0')}
                    </Text>
                    <Text style={[styles.videoTitle, state === 'locked' && styles.fadedText]} numberOfLines={2}>
                      {title}
                    </Text>
                    {state === 'generating' && <ShimmerBar cardWidth={CARD_WIDTH} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* CTA Card */}
          {!videoReady && (
            <View style={styles.ctaCard}>
              <View style={styles.bellCircle}>
                <MaterialCommunityIcons name="bell" size={20} color={Colors.PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctaTitle}>Stay updated</Text>
                <Text style={styles.ctaDesc}>
                  We'll let you know the moment your full series is ready to watch.
                </Text>
              </View>
              <TouchableOpacity style={styles.notifyBtn} activeOpacity={0.85}>
                <Text style={styles.notifyBtnLabel}>Notify Me</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 16,
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
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 16,
    color: Colors.OUTLINE,
  },
  scroll: { flex: 1, backgroundColor: Colors.SURFACE },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 24 },

  pickerRow: { gap: 8, paddingBottom: 4 },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: Colors.SURFACE_CONTAINER,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    maxWidth: 200,
  },
  pickerChipActive: { backgroundColor: Colors.PRIMARY, borderColor: Colors.PRIMARY },
  pickerChipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.ON_SURFACE },
  pickerChipTextActive: { color: '#fff' },

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

  videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  videoCard: {
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
  videoCardLocked: { opacity: 0.65 },

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
  ctaTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.ON_SURFACE },
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
  notifyBtnLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#fff' },
});
