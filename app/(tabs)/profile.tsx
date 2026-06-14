import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="title">Profile</Txt>
      </View>

      <Card style={styles.accountCard}>
        <View style={styles.avatar}>
          <IconSymbol name="person.fill" size={28} color={Palette.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="caption">Signed in as</Txt>
          <Txt variant="body" numberOfLines={1}>
            {user?.email ?? '—'}
          </Txt>
        </View>
      </Card>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Txt variant="body" color={Palette.accent}>
          Sign Out
        </Txt>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    alignItems: 'center',
  },
});
