import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNavBar from '../components/BottomNavBar';
import TopicsScreen from '../screens/TopicsScreen';
import ForYouScreen from '../screens/ForYouScreen';
import DeepResearchScreen from '../screens/DeepResearchScreen';
import VideoCreationScreen from '../screens/VideoCreationScreen';
import VoteScreen from '../screens/VoteScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Topics" component={TopicsScreen} />
      <Tab.Screen name="ForYou" component={ForYouScreen} />
      <Tab.Screen name="Research" component={DeepResearchScreen} />
      <Tab.Screen name="Videos" component={VideoCreationScreen} />
      <Tab.Screen name="Vote" component={VoteScreen} />
    </Tab.Navigator>
  );
}
