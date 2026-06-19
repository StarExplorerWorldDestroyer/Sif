import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Radius, Spacing } from '@/constants/theme';
import {
  disableWebPush,
  enableWebPush,
  isWebPushEnabled,
  isWebPushSupported,
} from '@/lib/push-web';
import { useCenteredContent } from '@/hooks/use-responsive';
import { describeRule, formatReminderDate, nextReminderDate } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';
import { useProfile } from '@/store/profile';
import { PRIVACY_OPTIONS, type Units } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, sendPasswordReset } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast, confirm } = useFeedback();
  const centered = useCenteredContent(640);

  const [busy, setBusy] = useState(false);
  const pushSupported = isWebPushSupported();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (pushSupported) isWebPushEnabled().then(setPushOn);
  }, [pushSupported]);

  async function togglePush(value: boolean) {
    setPushBusy(true);
    if (value) {
      const result = await enableWebPush();
      if (result === 'enabled') {
        setPushOn(true);
      } else {
        setPushOn(false);
        toast(
          result === 'denied'
            ? 'Your browser blocked notifications. Allow them in your browser settings to turn this on.'
            : 'Could not enable push notifications on this device.',
          { tone: 'error' },
        );
      }
    } else {
      await disableWebPush();
      setPushOn(false);
    }
    setPushBusy(false);
  }

  const currency = profile?.currency ?? 'USD';
  const units = profile?.units ?? 'in';

  const reminderRule = profile?.cutReminder?.rule;
  const reminderNext = reminderRule ? nextReminderDate(reminderRule) : null;
  const reminderSummary = reminderRule
    ? `${describeRule(reminderRule)}${reminderNext ? ` · next ${formatReminderDate(reminderNext)}` : ''}`
    : 'Off — tap to set one up';

  async function changePassword() {
    if (!user?.email) return;
    setBusy(true);
    const { error } = await sendPasswordReset(user.email);
    setBusy(false);
    if (error) {
      toast(error, { tone: 'error' });
    } else {
      toast(`We sent a password reset link to ${user.email}. Open it to set a new password.`, {
        tone: 'success',
      });
    }
  }

  async function confirmDelete() {
    const ok = await confirm({
      title: 'Delete account data?',
      message:
        'This permanently deletes all your haircuts and profile, then signs you out. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok || !user) return;
    await supabase.from('haircuts').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    await signOut();
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

      <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
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

          {pushSupported ? (
            <>
              <View style={styles.divider} />
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">Push notifications</Txt>
                  <Txt variant="caption">Get alerts in this browser even when Sif is closed.</Txt>
                </View>
                <Switch
                  value={pushOn}
                  disabled={pushBusy}
                  onValueChange={togglePush}
                  trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
                  thumbColor={Palette.text}
                />
              </View>
            </>
          ) : null}

          <View style={styles.divider} />

          <Pressable style={styles.actionRow} onPress={() => router.push('/reminder')}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">Cut reminder</Txt>
              <Txt variant="caption">{reminderSummary}</Txt>
            </View>
            <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.actionRow} onPress={() => router.push('/bookings')}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">Your bookings</Txt>
              <Txt variant="caption">Appointments you’ve requested or received.</Txt>
            </View>
            <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
          </Pressable>
        </View>

        <SectionTitle>Privacy & safety</SectionTitle>
        <View style={styles.card}>
          <Txt variant="label" style={styles.rowLabel}>
            Who can see your profile
          </Txt>
          <View style={styles.pillRow}>
            {PRIVACY_OPTIONS.map((opt) => {
              const active = (profile?.privacy ?? 'public') === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => updateProfile({ privacy: opt.value })}
                  style={[styles.pill, active && styles.pillActive]}>
                  <Txt variant="caption" color={active ? Palette.black : Palette.textMuted}>
                    {opt.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <Txt variant="caption" style={styles.hint}>
            {PRIVACY_OPTIONS.find((o) => o.value === (profile?.privacy ?? 'public'))?.hint}
          </Txt>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="body">Stylist account</Txt>
              <Txt variant="caption">
                Lets clients connect with you and tag you, and lets you create cuts for them.
              </Txt>
            </View>
            <Switch
              value={profile?.isStylist ?? false}
              onValueChange={(v) => {
                updateProfile({ isStylist: v });
              }}
              trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
              thumbColor={Palette.text}
            />
          </View>

          {profile?.isStylist ? (
            <>
              <View style={styles.divider} />
              <Pressable style={styles.actionRow} onPress={() => router.push('/dashboard')}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">Stylist dashboard</Txt>
                  <Txt variant="caption">Your ratings, schedule, clients, and earnings.</Txt>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.actionRow} onPress={() => router.push('/availability')}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">Booking availability</Txt>
                  <Txt variant="caption">Set your weekly hours and appointment length.</Txt>
                </View>
                <IconSymbol name="chevron.right" size={16} color={Palette.textDim} />
              </Pressable>
            </>
          ) : null}
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
  hint: { marginTop: Spacing.sm },
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
