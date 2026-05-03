import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import { api, Topic } from '../../src/services/api';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTopics().then(setTopics).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = query.trim()
    ? topics.filter((t) => t.topic.toLowerCase().includes(query.toLowerCase()))
    : topics;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>GroundTruth</Text>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.OUTLINE} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          placeholder="Search topics…"
          placeholderTextColor={Colors.OUTLINE}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={Colors.OUTLINE} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.PRIMARY} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>
              {query ? `No topics matching "${query}"` : 'No topics available yet.'}
            </Text>
          ) : (
            filtered.map((topic) => (
              <TouchableOpacity
                key={topic.id}
                style={styles.topicRow}
                onPress={() => router.push(`/topic/${topic.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.topicRowContent}>
                  <Text style={styles.topicRowTitle} numberOfLines={2}>{topic.topic}</Text>
                  <Text style={styles.topicRowSub} numberOfLines={1}>
                    {topic.pole_a} vs. {topic.pole_b}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.OUTLINE} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.SURFACE_CONTAINER_LOWEST,
  },
  header: {
    height: 56,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.SURFACE_CONTAINER_LOW,
  },
  wordmark: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 20,
    color: Colors.PRIMARY,
    letterSpacing: -0.3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.SURFACE_CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.SURFACE_CONTAINER_HIGH,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.ON_SURFACE,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  emptyText: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    color: Colors.OUTLINE,
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.SURFACE_CONTAINER_LOW,
  },
  topicRowContent: { flex: 1, marginRight: 8 },
  topicRowTitle: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: Colors.ON_SURFACE,
  },
  topicRowSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.OUTLINE,
    marginTop: 2,
  },
});
