import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { StarRating } from '@/components/ui/stars';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchStylistReviews } from '@/lib/reviews';
import type { Review } from '@/types';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Read-only ratings summary + review list for a stylist's public profile. */
export function StylistReviews({ stylistId }: { stylistId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);

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
});
