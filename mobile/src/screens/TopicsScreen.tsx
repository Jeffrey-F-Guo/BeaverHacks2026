import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import PlaceholderImage from '../components/PlaceholderImage';
import VeracityBadge from '../components/VeracityBadge';
import ProgressBar from '../components/ProgressBar';
import ConsensusPulseRow from '../components/ConsensusPulseRow';
import PillButton from '../components/PillButton';

const TOPICS = [
  {
    id: '1',
    category: 'Technology',
    title: 'The AGI Safety Threshold',
    summary:
      'As artificial general intelligence approaches reality, global institutions struggle to define meaningful safety benchmarks before deployment.',
    percent: 42,
    status: 'Divergent',
  },
  {
    id: '2',
    category: 'Environment',
    title: 'Degrowth vs. Green Growth',
    summary:
      'Economists and ecologists clash over whether sustained GDP growth can ever be truly decoupled from environmental destruction.',
    percent: 78,
    status: 'Converging',
  },
  {
    id: '3',
    category: 'Privacy',
    title: 'The End of Anonymity',
    summary:
      'Ubiquitous surveillance infrastructure and AI-powered identification systems are quietly erasing the concept of anonymous public life.',
    percent: 15,
    status: 'Polarized',
  },
];

function TopicCard({
  category,
  title,
  summary,
  percent,
  status,
}: (typeof TOPICS)[0]) {
  return (
    <View style={styles.card}>
      <View style={styles.cardImageContainer}>
        <PlaceholderImage style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['transparent', 'rgba(25,28,29,0.85)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.cardImageContent}>
          <Text style={styles.cardCategory}>{category.toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardSummary}>{summary}</Text>
        <ConsensusPulseRow label="Consensus Pulse" percent={percent} status={status} />
      </View>
    </View>
  );
}

export default function TopicsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>GroundTruth</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.ON_SURFACE} />
        </TouchableOpacity>
      </View>
      <ProgressBar percent={33} />

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
          {TOPICS.map((topic) => (
            <TopicCard key={topic.id} {...topic} />
          ))}
        </View>

        <View style={styles.ctaRow}>
          <PillButton label="Explore More Topics" />
        </View>
      </ScrollView>
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
  headerIcon: {
    padding: 4,
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
  ctaRow: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
});
