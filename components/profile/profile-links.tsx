import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

function normalizeWebsite(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function websiteLabel(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/** Instagram + website chips shown on a profile. Renders nothing if both empty. */
export function ProfileLinks({ instagram, website }: { instagram?: string; website?: string }) {
  const ig = (instagram ?? '').trim().replace(/^@/, '');
  const web = (website ?? '').trim();
  if (!ig && !web) return null;

  return (
    <View style={styles.row}>
      {ig ? (
        <Pressable style={styles.chip} onPress={() => openUrl(`https://instagram.com/${ig}`)}>
          <IconSymbol name="camera.fill" size={14} color={Palette.text} />
          <Txt variant="caption" color={Palette.text}>
            @{ig}
          </Txt>
        </Pressable>
      ) : null}
      {web ? (
        <Pressable style={styles.chip} onPress={() => openUrl(normalizeWebsite(web))}>
          <IconSymbol name="link" size={14} color={Palette.text} />
          <Txt variant="caption" color={Palette.text} numberOfLines={1}>
            {websiteLabel(web)}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 220,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
});
