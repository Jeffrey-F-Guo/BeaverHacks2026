import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ViewToken,
  ListRenderItemInfo,
  LayoutChangeEvent,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, Topic } from '../../src/services/api';
import { Colors } from '../../src/theme/colors';

const CTA_BG = Colors.PRIMARY_FIXED;
const CTA_FG = Colors.ON_SURFACE;

type Reel = {
  id: string;
  topic_id: string;
  video_url: string;
  topic_title: string;
  description: string;
};

function topicsToReels(topics: Topic[]): Reel[] {
  const reels: Reel[] = [];
  const ROLE_DESCRIPTIONS: Record<string, string> = {
    origin: 'The history that shaped this debate.',
    key_players: 'Who holds power in this conversation.',
    case_for_a: 'The strongest argument for one side.',
    case_for_b: 'The strongest argument for the other.',
    consequences: 'What happened where each path was taken.',
    where_we_stand: 'The live tension. What is at stake today.',
  };
  for (const topic of topics) {
    const videos = topic.video_urls ?? [];
    const scripts = topic.scripts ?? [];
    if (videos.length === 0) continue;
    videos.forEach((url, i) => {
      const script = scripts[i];
      reels.push({
        id: `${topic.id}-${i}`,
        topic_id: topic.id,
        video_url: url,
        topic_title: topic.topic,
        description: script?.headline ?? ROLE_DESCRIPTIONS[script?.role ?? ''] ?? '',
      });
    });
  }
  return reels;
}

type ReelItemProps = {
  item: Reel;
  active: boolean;
  height: number;
  screenFocused: boolean;
};

function ReelItem({ item, active, height, screenFocused }: ReelItemProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const router = useRouter();

  const player = useVideoPlayer(item.video_url, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (active && !paused && screenFocused) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, paused, screenFocused, player]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const dur = player.duration;
      if (dur > 0) setProgress(player.currentTime / dur);
    }, 100);
    return () => clearInterval(id);
  }, [active, player]);

  const handleLongPress = () => {
    player.playbackRate = 2;
    player.play();
    setIsFastForwarding(true);
  };

  const handlePressOut = () => {
    if (!isFastForwarding) return;
    player.playbackRate = 1;
    setIsFastForwarding(false);
    if (paused || !active) player.pause();
    else player.play();
  };

  return (
    <View style={[styles.reel, { height }]}>
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Tap to pause/play; hold for 2× speed */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => setPaused((p) => !p)}
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
        delayLongPress={200}
      />

      {/* Title chip */}
      <View
        pointerEvents="none"
        style={[
          styles.titleChip,
          { top: insets.top + 12, width: screenWidth - 32 },
        ]}
      >
        <Text style={styles.topicTitle} numberOfLines={3}>
          {item.topic_title}
        </Text>
        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>
      </View>

      {/* Explore Topic CTA */}
      <View pointerEvents="box-none" style={styles.ctaContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.exploreBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push(`/topic/${item.topic_id}`)}
        >
          <Ionicons name="play-circle" size={18} color={CTA_FG} />
          <Text style={styles.exploreText}>Explore Topic</Text>
        </Pressable>
      </View>

      {/* Progress bar — sits just above the CTA */}
      <View pointerEvents="none" style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      {/* 2× speed badge — visible while holding */}
      {isFastForwarding && (
        <View pointerEvents="none" style={[styles.speedBadge, { top: insets.top + 12 }]}>
          <Text style={styles.speedText}>2×</Text>
        </View>
      )}

      {/* Center play indicator when paused */}
      {paused && (
        <View pointerEvents="none" style={styles.pauseIndicator}>
          <View style={styles.pausePill}>
            <Ionicons name="play" size={28} color="#fff" />
          </View>
        </View>
      )}
    </View>
  );
}

export default function ForYouScreen() {
  const [containerHeight, setContainerHeight] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenFocused, setScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  useEffect(() => {
    api.getTopics().then((topics) => {
      setReels(topicsToReels(topics));
    }).catch(() => {
      // Silently fall through — empty feed shown
    }).finally(() => setLoading(false));
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h !== containerHeight) setContainerHeight(h);
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setCurrentIndex(first.index);
    }
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
  }).current;

  const renderItem = ({ item, index }: ListRenderItemInfo<Reel>) => (
    <ReelItem
      item={item}
      active={index === currentIndex}
      height={containerHeight}
      screenFocused={screenFocused}
    />
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      )}
      {!loading && containerHeight > 0 && (
        <FlatList
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({
            length: containerHeight,
            offset: containerHeight * i,
            index: i,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          ListEmptyComponent={
            <View style={[styles.loader, { height: containerHeight }]}>
              <Text style={styles.emptyText}>No videos available yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  reel: {
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },

  titleChip: {
    position: 'absolute',
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 6,
    overflow: 'hidden',
  },
  topicTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    color: '#fff',
    letterSpacing: -0.3,
  },
  description: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.7)',
  },

  ctaContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 4,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: CTA_BG,
  },
  exploreText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: CTA_FG,
    letterSpacing: 0.2,
  },

  pauseIndicator: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausePill: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  progressTrack: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: 2,
    backgroundColor: '#fff',
  },

  speedBadge: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  speedText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
});
