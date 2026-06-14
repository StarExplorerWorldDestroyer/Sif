import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';
import type { Units } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();

  const [busy, setBusy] = useState(false);

  const currency = profile?.currency ?? 'USD';
  const units = profile?.units ?? 'in';

  async function changePassword() {
    if (!user?.email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    setBusy(false);
    Alert.alert(
      error ? 'Error' : 'Check your email',
      error ? error.message : `We sent a password reset link to ${user.email}.`,
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account data?',
      'This permanently deletes all your haircuts and profile, then signs you out. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await supabase.from('haircuts').delete().eq('user_id', user.id);
            await supabase.from('profiles').delete().eq('id', user.id);
            await signOut();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Settings</Txt>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionTitle>Preferences</SectionTitle>

        <View style={styles.card}>
          <Txt variant="label" style={styles.rowLabel}>
            Currency
          </Txt>
          <View style={styles.pillRow}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => updateProfile({ currency: c })}
                style={[styles.pill, c === currency && styles.pillActive]}>
                <Txt variant="caption" color={c === currency ? Palette.black : Palette.textMuted}>
                  {c}
                </Txt>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <Txt variant="label" style={styles.rowLabel}>
            Length units
          </Txt>
          <View style={styles.pillRow}>
            {(['in', 'cm'] as Units[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => updateProfile({ units: u })}
                style={[styles.pill, u === units && styles.pillActive]}>
                <Txt variant="caption" color={u === units ? Palette.black : Palette.textMuted}>
                  {u === 'in' ? 'Inches' : 'Centimeters'}
                </Txt>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">Public profile</Txt>
              <Txt variant="caption">Let others find and view your profile.</Txt>
            </View>
            <Switch
              value={profile?.profilePublic ?? false}
              onValueChange={(v) => {
                updateProfile({ profilePublic: v });
              }}
              trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
              thumbColor={Palette.text}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">Notifications</Txt>
              <Txt variant="caption">Reminders and activity updates.</Txt>
            </View>
            <Switch
              value={profile?.notificationsEnabled ?? true}
              onValueChange={(v) => {
                updateProfile({ notificationsEnabled: v });
              }}
              trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
              thumbColor={Palette.text}
            />
          </View>
        </View>

        <SectionTitle>Account</SectionTitle>
        <View style={styles.card}>
          <Txt variant="caption">Signed in as</Txt>
          <Txt variant="body" style={{ marginBottom: Spacing.sm }}>
            {user?.email}
          </Txt>

          <Pressable style={styles.actionRow} onPress={changePassword} disabled={busy}>
            <Txt variant="body" color={Palette.text}>
              Change password
            </Txt>
            <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.actionRow} onPress={signOut}>
            <Txt variant="body" color={Palette.accent}>
              Sign Out
            </Txt>
          </Pressable>
        </View>

        <Pressable style={styles.deleteButton} onPress={confirmDelete}>
          <IconSymbol name="trash" size={16} color={Palette.accent} />
          <Txt variant="label" color={Palette.accent}>
            Delete account data
          </Txt>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionTitle: { marginBottom: Spacing.sm, marginTop: Spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  rowLabel: { marginBottom: Spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  pillActive: { backgroundColor: Palette.accent },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.border,
    marginVertical: Spacing.lg,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
});
