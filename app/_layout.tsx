import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { WebFrame } from '@/components/ui/web-frame';
import { Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/store/auth';
import { FeedbackProvider } from '@/store/feedback';
import { HaircutsProvider } from '@/store/haircuts';
import { MessagesProvider } from '@/store/messages';
import { NotificationsProvider } from '@/store/notifications';
import { PostsProvider } from '@/store/posts';
import { ProfileProvider, useProfile } from '@/store/profile';
import { SocialProvider } from '@/store/social';

export const unstable_settings = {
  anchor: '(tabs)',
};

// The app is dark-only. Start from React Navigation's DarkTheme and override
// the background to pure black and the accent to our orange.
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.bg,
    card: Palette.bg,
    primary: Palette.accent,
    text: Palette.text,
    border: Palette.border,
  },
};

/** Redirects between login, onboarding, and the app based on auth/profile state. */
function useAuthRedirect() {
  const { user, loading, recovering } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
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
    const onLanding = segments[0] === 'landing';
    const onReset = segments[0] === 'reset';
    const onOnboarding = segments[0] === 'onboarding';
    // Public, shareable routes that don't require being signed in. Legal pages
    // must stay reachable logged-out for the App Store privacy/terms URLs.
    const onPublicRoute =
      segments[0] === 'u' ||
      segments[0] === 'p' ||
      segments[0] === 'likes' ||
      segments[0] === 'privacy' ||
      segments[0] === 'terms';

    // Logged-out visitors land on the Golden Sif splash; the page's Enter
    // button takes them to /login. Login stays directly reachable too.
    if (!user && !onLoginScreen && !onLanding && !onPublicRoute) {
      router.replace('/landing');
      return;
    }
    if (user && (onLoginScreen || onLanding)) {
      router.replace('/');
      return;
    }
    // First-run gate: a signed-in user must pick a username before using the app.
    if (user && !onPublicRoute && !onReset) {
      if (profileLoading) return;
      const needsOnboarding = !profile?.username;
      if (needsOnboarding && !onOnboarding) {
        router.replace('/onboarding');
      } else if (!needsOnboarding && onOnboarding) {
        router.replace('/');
      }
    }
  }, [user, loading, recovering, profile, profileLoading, segments, router]);
}

function RootNavigator() {
  useAuthRedirect();
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.bg } }}>
      <Stack.Screen name="landing" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="haircut/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="discover/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="connections" options={{ headerShown: false }} />
      <Stack.Screen name="pending" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="blocked" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="insights" options={{ headerShown: false }} />
      <Stack.Screen name="journal" options={{ headerShown: false }} />
      <Stack.Screen name="reminder" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="post/new" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="u/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="p/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="likes/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="bookings" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="messages" options={{ headerShown: false }} />
      <Stack.Screen name="messages/new" options={{ headerShown: false }} />
      <Stack.Screen name="messages/share" options={{ headerShown: false }} />
      <Stack.Screen name="messages/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="book/[id]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="pay/[id]" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="availability" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="services" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="tryon" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="reset" options={{ headerShown: false }} />
      <Stack.Screen name="privacy" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <SocialProvider>
          <NotificationsProvider>
            <MessagesProvider>
              <HaircutsProvider>
                <PostsProvider>
                  <ThemeProvider value={AppTheme}>
                    <FeedbackProvider>
                      <WebFrame>
                        <RootNavigator />
                      </WebFrame>
                    </FeedbackProvider>
                    <StatusBar style="light" />
                  </ThemeProvider>
                </PostsProvider>
              </HaircutsProvider>
            </MessagesProvider>
          </NotificationsProvider>
        </SocialProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
