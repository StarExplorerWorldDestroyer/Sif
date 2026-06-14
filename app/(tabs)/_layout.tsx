import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: Palette.accent,
        tabBarInactiveTintColor: Palette.textMuted,
        tabBarStyle: {
          backgroundColor: Palette.black,
          borderTopColor: Palette.border,
        },
        // Compact, finance-app style labels.
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cuts',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="scissors" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="safari" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
