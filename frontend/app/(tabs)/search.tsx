import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>
          Coming soon — browse topics by issue area.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    fontFamily: 'Newsreader_600SemiBold',
    fontSize: 32,
    color: '#fff',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: 'Newsreader_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
});
