import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import VeracityBadge from '../../src/components/VeracityBadge';
import ProgressBar from '../../src/components/ProgressBar';
import ConsensusPulseRow from '../../src/components/ConsensusPulseRow';
import { api, Topic, VoteDistribution } from '../../src/services/api';

function consensusStatus(mean: number | null): { percent: number; status: string } {
  if (mean === null) return { percent: 50, status: 'No votes yet' };
  const percent = Math.round(mean * 100);
  if (percent < 30) return { percent, status: 'Polarized' };
  if (percent < 60) return { percent, status: 'Divergent' };
  return { percent, status: 'Converging' };
}

type TopicWithVotes = Topic & { distribution?: VoteDistribution };

function TopicCard({ topic, onPress }: { topic: TopicWithVotes; onPress: () => void }) {
  const { percent, status } = consensusStatus(topic.distribution?.mean ?? null);
  const isReady = topic.pipeline_status?.video === 'complete';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardImageContainer}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.PRIMARY_CONTAINER }]} />
        <LinearGradient
          colors={['transparent', 'rgba(25,28,29,0.85)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.cardImageContent}>
          <Text style={styles.cardCategory}>
            {isReady ? 'READY TO WATCH' : 'IN PROGRESS'}
          </Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{topic.topic}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardSummary} numberOfLines={3}>
          {topic.pole_a} vs. {topic.pole_b}
        </Text>
        <ConsensusPulseRow label="Consensus Pulse" percent={percent} status={status} />
      </View>
    </TouchableOpacity>
  );
}

export default function TopicsScreen() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicWithVotes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTopics().then(async (data) => {
      // Fetch vote distributions in parallel
      const withVotes = await Promise.all(
        data.map(async (t) => {
          try {
            const distribution = await api.getVoteDistribution(t.id);
            return { ...t, distribution };
          } catch {
            return t;
          }
        })
      );
      setTopics(withVotes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Verdict</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
      </View>
      <ProgressBar percent={loading ? 0 : Math.min(topics.length * 10, 100)} />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <VeracityBadge label="Veracity Guaranteed" />
            <Text style={styles.heroTitle}>What the world is debating</Text>
            <Text style={styles.heroSubtitle}>
              Every topic is researched by AI, debated by AI, and voted on by you. Real consensus. Real stakes.
            </Text>
          </View>

          <View style={styles.topicsList}>
            {topics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onPress={() => router.push(`/topic/${topic.id}`)}
              />
            ))}
            {topics.length === 0 && (
              <Text style={styles.emptyText}>No topics available yet.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 20,
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.SURFACE,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 12,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderBottomWidth: 1,
    borderBottomColor: Colors.SURFACE_CONTAINER_LOW,
  },
  heroTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 36,
    lineHeight: 42,
    color: Colors.ON_SURFACE,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroSubtitle: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: Colors.ON_SURFACE_VARIANT,
  },
  topicsList: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 32,
  },
  card: {
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImageContainer: {
    height: 200,
    position: 'relative',
  },
  cardImageContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    gap: 6,
  },
  cardCategory: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.75)',
  },
  cardTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
    color: '#ffffff',
  },
  cardBody: {
    padding: 20,
  },
  cardSummary: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: Colors.ON_SURFACE_VARIANT,
  },
  emptyText: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 16,
    color: Colors.OUTLINE,
    textAlign: 'center',
    paddingVertical: 40,
  },
});
