import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

const NAV: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Cuts', icon: 'scissors' },
  explore: { label: 'Explore', icon: 'safari' },
  profile: { label: 'Profile', icon: 'person.fill' },
};

/** Desktop left-rail navigation, rendered as the Tabs `tabBar` on wide web. */
export function Sidebar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <Txt variant="title" color={Palette.accent}>
          Sif
        </Txt>
      </View>

      <View style={styles.nav}>
        {state.routes.map((route, index) => {
          const meta = NAV[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              style={[styles.item, focused && styles.itemActive]}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}>
              <IconSymbol
                name={meta.icon}
                size={22}
                color={focused ? Palette.accent : Palette.textMuted}
              />
              <Txt variant="body" color={focused ? Palette.text : Palette.textMuted}>
                {meta.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.addButton} onPress={() => router.push('/add')}>
        <IconSymbol name="plus" size={18} color={Palette.black} />
        <Txt variant="label" color={Palette.black} style={styles.addLabel}>
          New cut
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 232,
    height: '100%',
    backgroundColor: Palette.black,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Palette.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xl,
    gap: Spacing.xl,
  },
  brand: { paddingHorizontal: Spacing.md },
  nav: { gap: Spacing.xs, flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  itemActive: { backgroundColor: Palette.surface },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
  },
  addLabel: { fontWeight: '600' },
});
