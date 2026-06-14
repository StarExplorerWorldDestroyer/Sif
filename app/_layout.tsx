import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { HaircutsProvider } from '@/store/haircuts';

export const unstable_settings = {
  anchor: '(tabs)',
};

// The app is dark-only. Start from React Navigation's DarkTheme and override
// the background to pure black and the accent to our orange.
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.black,
    card: Palette.black,
    primary: Palette.accent,
    text: Palette.text,
    border: Palette.border,
  },
};

/** Redirects between the login screen and the app based on auth state. */
function useAuthRedirect() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLoginScreen = segments[0] === 'login';
    if (!user && !onLoginScreen) {
      router.replace('/login');
    } else if (user && onLoginScreen) {
      router.replace('/');
    }
  }, [user, loading, segments, router]);
}

function RootNavigator() {
  useAuthRedirect();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.black } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="haircut/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <HaircutsProvider>
        <ThemeProvider value={AppTheme}>
          <RootNavigator />
          <StatusBar style="light" />
        </ThemeProvider>
      </HaircutsProvider>
    </AuthProvider>
  );
}
