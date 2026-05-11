import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import HomeScreen from './src/screens/HomeScreen';
import ActiveRecordingScreen from './src/screens/ActiveRecordingScreen';
import ImportAudioScreen from './src/screens/ImportAudioScreen';
import ProcessingScreen from './src/screens/ProcessingScreen';
import MeetingSummaryScreen from './src/screens/MeetingSummaryScreen';
import ApiKeySetupScreen from './src/screens/ApiKeySetupScreen';
import LoginScreen from './src/screens/LoginScreen';
import { RootStackParamList } from './src/types';
import { lightColors } from './src/theme';
import { AppProvider, useAppContext } from './src/context/AppContext';
import { StatusBar } from 'expo-status-bar';

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { colors, isDark, session, loadingAuth } = useAppContext();

  if (loadingAuth) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.headerBg} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="ActiveRecording"
          component={ActiveRecordingScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="ImportAudio" component={ImportAudioScreen} />
        <Stack.Screen
          name="Processing"
          component={ProcessingScreen}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="MeetingSummary" component={MeetingSummaryScreen} />
        <Stack.Screen
          name="ApiKeySetup"
          component={ApiKeySetupScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    'ionicons': Platform.OS === 'android'
      ? { uri: 'file:///android_asset/fonts/ionicons.ttf' }
      : require('./assets/fonts/Ionicons.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={lightColors.primary} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.background,
  },
});
