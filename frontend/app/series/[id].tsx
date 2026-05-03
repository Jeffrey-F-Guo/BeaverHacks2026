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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, TopicDetail } from '../../src/services/api';
import { Colors } from '../../src/theme/colors';
import { markWatched, getWatchedCount } from '../../src/services/watchStore';

const PART_NAMES = [
  'Origin',
  'Key Players',
  'The Case For',
  'The Case Against',
  'Consequences',
  'Where We Stand',
];

type Part = {
  index: number;
  video_url: string;
  part_label: string;
  headline: string;
  topic_title: string;
  topic_id: string;
};

type PartItemProps = {
  item: Part;
  active: boolean;
  height: number;
  onDeepDive: () => void;
};

function PartItem({ item, active, height, onDeepDive }: PartItemProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [paused, setPaused] = useState(false);

  const player = useVideoPlayer(item.video_url, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    if (active && !paused) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, paused, player]);

  return (
    <View style={[styles.reel, { height }]}>
      <VideoView
        style={StyleSheet.absoluteFillObject}
        player={player}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Tap layer */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => setPaused((p) => !p)}
      />

      {/* Title chip */}
      <View
        pointerEvents="none"
        style={[styles.titleChip, { top: insets.top + 56, width: screenWidth - 32 }]}
      >
        <Text style={styles.partLabel}>
          Part {item.index + 1} of {PART_NAMES.length} — {item.part_label}
        </Text>
        <Text style={styles.headline} numberOfLines={3}>
          {item.headline}
        </Text>
      </View>

      {/* Deep Dive CTA */}
      {/* <View pointerEvents="box-none" style={[styles.ctaContainer, { bottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.deepDiveBtn, pressed && { opacity: 0.85 }]}
          onPress={onDeepDive}
        >
          <MaterialCommunityIcons name="flask-outline" size={18} color={Colors.ON_SURFACE} />
          <Text style={styles.deepDiveText}>Deep Dive</Text>
        </Pressable>
      </View> */}

      {/* Pause indicator */}
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

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [containerHeight, setContainerHeight] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [watchedCount, setWatchedCount] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const completeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id) return;
    api.getTopic(id).then((t) => {
      setTopic(t);
      const urls = t.video_urls ?? [];
      const scripts = t.scripts ?? [];
      const built: Part[] = urls.map((url, i) => ({
        index: i,
        video_url: url,
        part_label: PART_NAMES[i] ?? `Part ${i + 1}`,
        headline: scripts[i]?.headline ?? '',
        topic_title: t.topic,
        topic_id: t.id,
      }));
      setParts(built);
      setWatchedCount(getWatchedCount(id));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const triggerComplete = useCallback(() => {
    setShowComplete(true);
    Animated.sequence([
      Animated.timing(completeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(completeOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setShowComplete(false));
  }, [completeOpacity]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index == null || !id) return;
      const idx = first.index;
      setCurrentIndex(idx);
      markWatched(id, idx);
      const newCount = getWatchedCount(id);
      setWatchedCount(newCount);
      if (newCount === 6 && idx === 5) {
        triggerComplete();
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h !== containerHeight) setContainerHeight(h);
  };

  const handleDeepDive = useCallback(() => {
    router.push(`/deep-dive/${id}`);
  }, [router, id]);

  const renderItem = ({ item, index }: ListRenderItemInfo<Part>) => (
    <PartItem
      item={item}
      active={index === currentIndex}
      height={containerHeight}
      onDeepDive={handleDeepDive}
    />
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />

      {/* Top overlay: back + progress */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View pointerEvents="none" style={styles.progressPill}>
          <Text style={styles.progressText}>{watchedCount}/6 watched</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      )}

      {!loading && containerHeight > 0 && (
        <FlatList
          data={parts}
          keyExtractor={(item) => `${item.topic_id}-${item.index}`}
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
              <Text style={styles.emptyText}>Videos not available yet.</Text>
            </View>
          }
        />
      )}

      {/* Series complete overlay */}
      {showComplete && (
        <Animated.View
          style={[styles.completeOverlay, { opacity: completeOpacity }]}
          pointerEvents="none"
        >
          <MaterialCommunityIcons name="check-circle" size={48} color={Colors.PRIMARY_FIXED} />
          <Text style={styles.completeTitle}>Series Complete</Text>
          <Text style={styles.completeSubtitle}>You can now cast your vote.</Text>
        </Animated.View>
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

  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  progressPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  progressText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.3,
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
  partLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.PRIMARY_FIXED,
  },
  headline: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    color: '#fff',
    letterSpacing: -0.3,
  },

  ctaContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  deepDiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.PRIMARY_FIXED,
  },
  deepDiveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.ON_SURFACE,
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

  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 12,
    zIndex: 20,
  },
  completeTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.3,
  },
  completeSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
  },
});
