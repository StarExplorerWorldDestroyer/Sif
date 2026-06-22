import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { blockUser, reportContent, type ReportTargetType } from '@/lib/moderation';
import { useFeedback } from '@/store/feedback';

type Props = {
  /** The user this menu acts on (the author / the other party). */
  userId: string;
  username?: string | null;
  /** The specific content being viewed, if any. Omit to report the user. */
  content?: { type: Exclude<ReportTargetType, 'user'>; id: string } | null;
  /** Called after a successful block (e.g. to navigate away / refresh). */
  onBlocked?: () => void;
  color?: string;
  size?: number;
};

/**
 * Overflow menu that lets a user report content and block another user — the
 * safety controls the App Store expects on apps with user-generated content
 * and messaging. Reuse it anywhere you show someone else's content.
 */
export function ModerationMenu({ userId, username, content, onBlocked, color = Palette.text, size = 24 }: Props) {
  const [open, setOpen] = useState(false);
  const { confirm, prompt, toast } = useFeedback();
  const handle = username ? `@${username}` : 'this user';
  const what = content ? content.type : 'user';

  const onReport = async () => {
    setOpen(false);
    const reason = await prompt({
      title: `Report ${what}`,
      message: `Tell us what's wrong${content ? ` with this ${content.type}` : ` with ${handle}`}. Our team will review it.`,
      placeholder: 'Reason (optional)',
      multiline: true,
      confirmLabel: 'Submit report',
    });
    if (reason === null) return;
    const ok = await reportContent({
      targetType: content?.type ?? 'user',
      targetId: content?.id ?? userId,
      targetUserId: userId,
      reason,
    });
    toast(ok ? 'Thanks — your report was submitted.' : 'Could not submit report.', {
      tone: ok ? 'success' : 'error',
    });
  };

  const onBlock = async () => {
    setOpen(false);
    const yes = await confirm({
      title: `Block ${handle}?`,
      message: `They won't be able to message you or see your profile and posts, and you won't see theirs.`,
      confirmLabel: 'Block',
      destructive: true,
    });
    if (!yes) return;
    const ok = await blockUser(userId);
    toast(ok ? `Blocked ${handle}.` : 'Could not block this user.', { tone: ok ? 'success' : 'error' });
    if (ok) onBlocked?.();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="More options">
        <IconSymbol name="ellipsis" size={size} color={color} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Pressable style={styles.item} onPress={onReport} accessibilityRole="button">
              <IconSymbol name="flag" size={20} color={Palette.text} />
              <Txt variant="body">Report {what}</Txt>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.item} onPress={onBlock} accessibilityRole="button">
              <IconSymbol name="hand.raised.fill" size={20} color={Palette.accent} />
              <Txt variant="body" color={Palette.accent}>
                Block {handle}
              </Txt>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sheet: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Palette.border },
});
