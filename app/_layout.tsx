import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { WebFrame } from '@/components/ui/web-frame';
import { Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { HaircutsProvider } from '@/store/haircuts';
import { PostsProvider } from '@/store/posts';
import { ProfileProvider } from '@/store/profile';

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
  const { user, loading, recovering } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // A user who clicked a password-reset link must set a new password first.
    if (recovering) {
      if (segments[0] !== 'reset') router.replace('/reset');
      return;
    }
    const onLoginScreen = segments[0] === 'login';
    // Public, shareable routes that don't require being signed in.
    const onPublicRoute = segments[0] === 'u' || segments[0] === 'p';
    if (!user && !onLoginScreen && !onPublicRoute) {
      router.replace('/login');
    } else if (user && onLoginScreen) {
      router.replace('/');
    }
  }, [user, loading, recovering, segments, router]);
}

function RootNavigator() {
  useAuthRedirect();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.black } }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="haircut/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="post/new" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="u/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="reset" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <HaircutsProvider>
          <PostsProvider>
            <ThemeProvider value={AppTheme}>
              <WebFrame>
                <RootNavigator />
              </WebFrame>
              <StatusBar style="light" />
            </ThemeProvider>
          </PostsProvider>
        </HaircutsProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
