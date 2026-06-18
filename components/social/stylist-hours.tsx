import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { fetchAvailability, fetchBookingSettings } from '@/lib/bookings';
import type { AvailabilityWindow, BookingSettings } from '@/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/** Read-only weekly hours for a stylist, shown on their public profile. */
export function StylistHours({ stylistId }: { stylistId: string }) {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [w, s] = await Promise.all([
        fetchAvailability(stylistId),
        fetchBookingSettings(stylistId),
      ]);
      if (active) {
        setWindows(w);
        setSettings(s);
        setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [stylistId]);

  if (!loaded) return null;

  const byDay = new Map<number, AvailabilityWindow[]>();
  for (const w of windows) {
    const arr = byDay.get(w.weekday) ?? [];
    arr.push(w);
    byDay.set(w.weekday, arr);
  }
  const hasHours = windows.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Txt variant="label" color={Palette.textMuted} style={styles.title}>
          HOURS
        </Txt>
        {settings && !settings.acceptsBookings ? (
          <Txt variant="caption" color={Palette.textMuted}>
            Not accepting bookings
          </Txt>
        ) : null}
      </View>

      {!hasHours ? (
        <Txt variant="caption" color={Palette.textMuted}>
          Hours not set yet.
        </Txt>
      ) : (
        [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
          const wins = byDay.get(weekday);
          return (
            <View key={weekday} style={styles.dayRow}>
              <Txt variant="label" color={Palette.text} style={styles.dayName}>
                {DAYS[weekday]}
              </Txt>
              <Txt variant="label" color={wins ? Palette.text : Palette.textDim}>
                {wins
                  ? wins
                      .sort((a, b) => a.startMin - b.startMin)
                      .map((w) => `${timeLabel(w.startMin)} – ${timeLabel(w.endMin)}`)
                      .join(', ')
                  : 'Closed'}
              </Txt>
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
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: { letterSpacing: 1 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  dayName: { width: 44 },
});
