import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRating } from '@/components/ui/stars';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchStylistReviews, replyToReview } from '@/lib/reviews';
import type { Review } from '@/types';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Read-only ratings summary + review list for a stylist's public profile.
 * When `canReply` is true (the viewer is the stylist), each review gains an
 * inline reply composer.
 */
export function StylistReviews({
  stylistId,
  canReply = false,
}: {
  stylistId: string;
  canReply?: boolean;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const rows = await fetchStylistReviews(stylistId);
      if (active) {
        setReviews(rows);
        setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [stylistId]);

  if (!loaded) return null;

  const count = reviews.length;
  const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  const startReply = (r: Review) => {
    setEditingId(r.id);
    setDraft(r.reply);
  };

  const saveReply = async (r: Review) => {
    setSaving(true);
    const reply = draft.trim();
    const { error } = await replyToReview(r.id, reply);
    setSaving(false);
    if (error) return;
    setReviews((prev) =>
      prev.map((x) =>
        x.id === r.id ? { ...x, reply, replyAt: reply ? new Date().toISOString() : null } : x,
      ),
    );
    setEditingId(null);
    setDraft('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Txt variant="label" color={Palette.textMuted} style={styles.title}>
          REVIEWS
        </Txt>
        {count > 0 ? (
          <View style={styles.summary}>
            <StarRating value={avg} size={14} />
            <Txt variant="caption" color={Palette.textMuted}>
              {avg.toFixed(1)} · {count}
            </Txt>
          </View>
        ) : null}
      </View>

      {count === 0 ? (
        <Txt variant="caption" color={Palette.textMuted}>
          No reviews yet.
        </Txt>
      ) : (
        reviews.map((r) => {
          const name =
            r.author.displayName || (r.author.username ? `@${r.author.username}` : 'Sif user');
          const editing = editingId === r.id;
          return (
            <View key={r.id} style={styles.review}>
              {r.author.avatarUrl ? (
                <Image source={{ uri: r.author.avatarUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <IconSymbol name="person.fill" size={14} color={Palette.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.reviewHead}>
                  <Txt variant="label" numberOfLines={1} style={{ flex: 1 }}>
                    {name}
                  </Txt>
                  <Txt variant="caption" color={Palette.textDim}>
                    {timeAgo(r.createdAt)}
                  </Txt>
                </View>
                <StarRating value={r.rating} size={12} />
                {r.body ? (
                  <Txt variant="label" color={Palette.textMuted} style={styles.body}>
                    {r.body}
                  </Txt>
                ) : null}

                {r.reply && !editing ? (
                  <View style={styles.reply}>
                    <Txt variant="caption" color={Palette.accent} style={styles.replyLabel}>
                      Reply from stylist
                    </Txt>
                    <Txt variant="label" color={Palette.text}>
                      {r.reply}
                    </Txt>
                  </View>
                ) : null}

                {editing ? (
                  <View style={styles.replyEditor}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Write a reply…"
                      placeholderTextColor={Palette.textDim}
                      style={styles.replyInput}
                      multiline
                      autoFocus
                    />
                    <View style={styles.replyActions}>
                      <Pressable onPress={() => setEditingId(null)} hitSlop={6}>
                        <Txt variant="caption" color={Palette.textMuted}>
                          Cancel
                        </Txt>
                      </Pressable>
                      <Pressable onPress={() => saveReply(r)} disabled={saving} hitSlop={6}>
                        <Txt variant="caption" color={Palette.accent} style={{ fontWeight: '600' }}>
                          {saving ? 'Saving…' : r.reply ? 'Update' : 'Post reply'}
                        </Txt>
                      </Pressable>
                    </View>
                  </View>
                ) : canReply ? (
                  <Pressable onPress={() => startReply(r)} hitSlop={6} style={styles.replyTrigger}>
                    <Txt variant="caption" color={Palette.accent}>
                      {r.reply ? 'Edit reply' : 'Reply'}
                    </Txt>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: { letterSpacing: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  review: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: Radius.pill, backgroundColor: Palette.surfaceAlt },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  body: { marginTop: 2 },
  reply: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Palette.accent,
    gap: 1,
  },
  replyLabel: { letterSpacing: 0.5 },
  replyTrigger: { marginTop: Spacing.xs, alignSelf: 'flex-start' },
  replyEditor: { marginTop: Spacing.sm, gap: Spacing.xs },
  replyInput: {
    color: Palette.text,
    fontSize: 14,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
});
