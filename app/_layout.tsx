import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Palette } from '@/constants/theme';
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

export default function RootLayout() {
  return (
    <HaircutsProvider>
      <ThemeProvider value={AppTheme}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: Palette.black } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="haircut/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="add"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </HaircutsProvider>
  );
}
