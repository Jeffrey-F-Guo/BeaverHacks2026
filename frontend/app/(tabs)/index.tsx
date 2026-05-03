import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

const SUPABASE_PREFIX =
  'https://vjpyzcejomgjlcxjawgr.supabase.co/storage/v1/object/public/groundtruth/videos/open-source-vs-closed-source-llms';

const CTA_BG = '#C7CFFE';
const CTA_FG = '#1A1F40';

type Reel = {
  id: string;
  video_url: string;
  topic_title: string;
  description: string;
};

// TODO: replace with GET /reels fetch once endpoint is added.
const REELS: Reel[] = [
  {
    id: '1',
    video_url: `${SUPABASE_PREFIX}/short_00_origin.mp4`,
    topic_title: 'Open vs. Closed Source LLMs',
    description: 'The fork that defined a decade of AI development.',
  },
  {
    id: '2',
    video_url: `${SUPABASE_PREFIX}/short_01_key_players.mp4`,
    topic_title: 'Open vs. Closed Source LLMs',
    description: 'Three governments, two labs, and one open-source community.',
  },
  {
    id: '3',
    video_url: `${SUPABASE_PREFIX}/short_02_case_for_a.mp4`,
    topic_title: 'Open vs. Closed Source LLMs',
    description: 'A free flow of weights as the antidote to capture.',
  },
  {
    id: '4',
    video_url: `${SUPABASE_PREFIX}/short_03_case_for_b.mp4`,
    topic_title: 'Open vs. Closed Source LLMs',
    description: 'Misuse risks that argue for restraint over release.',
  },
  {
    id: '5',
    video_url: `${SUPABASE_PREFIX}/short_04_consequences.mp4`,
    topic_title: 'Open vs. Closed Source LLMs',
    description: 'What happened in markets where each path won.',
  },
  {
    id: '6',
    video_url: `${SUPABASE_PREFIX}/short_05_where_we_stand.mp4`,
    topic_title: 'Open vs. Closed Source LLMs',
    description: 'The fight is no longer theoretical. It is happening this quarter.',
  },
];

type ReelItemProps = {
  item: Reel;
  active: boolean;
  height: number;
};

function ReelItem({ item, active, height }: ReelItemProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [paused, setPaused] = useState(false);

  const player = useVideoPlayer(item.video_url, (p) => {
    p.loop = true;
    p.muted = true;
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

      {/* Tap layer for play/pause */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => setPaused((p) => !p)}
      />

      {/* Title chip — full width at the top (top safe area inset) */}
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

      {/* Explore Topic CTA — pinned to the bottom of THIS reel so it scrolls with it */}
      <View pointerEvents="box-none" style={styles.ctaContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.exploreBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            // TODO: route to /topic/[id] when topic detail screen exists
          }}
        >
          <Ionicons name="play-circle" size={18} color={CTA_FG} />
          <Text style={styles.exploreText}>Explore Topic</Text>
        </Pressable>
      </View>

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
    />
  );

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar style="light" />
      {containerHeight > 0 && (
        <FlatList
          data={REELS}
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
});
