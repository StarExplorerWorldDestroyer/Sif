import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { UpdateTimeline } from '@/components/cuts/update-timeline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Pill } from '@/components/ui/pill';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent, useIsDesktop } from '@/hooks/use-responsive';
import { useFeedback } from '@/store/feedback';
import { useHaircuts } from '@/store/haircuts';
import { angleLabel, type Photo } from '@/types';

export default function HaircutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getById, toggleLike, toggleBookmark, deleteHaircut } = useHaircuts();
  const { confirm } = useFeedback();
  const money = useMoney();
  const centered = useCenteredContent(640);

  const haircut = getById(id);

  // Private info always starts hidden for each haircut viewed.
  const [showPrivate, setShowPrivate] = useState(false);

  if (!haircut) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Txt variant="label">Haircut not found.</Txt>
        </View>
      </SafeAreaView>
    );
  }

  const { stylist } = haircut;

  async function confirmDelete() {
    const ok = await confirm({
      title: 'Delete haircut?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteHaircut(haircut!.id);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        onBack={() => router.back()}
        onEdit={() => router.push({ pathname: '/add', params: { id: haircut.id } })}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={centered ?? undefined}>
        <Gallery photos={haircut.photos} />

        {/* Social action bar */}
        <View style={styles.socialBar}>
          <Pressable style={styles.socialItem} onPress={() => toggleLike(haircut.id)} hitSlop={8}>
            <IconSymbol
              name={haircut.liked ? 'heart.fill' : 'heart'}
              size={22}
              color={haircut.liked ? Palette.accent : Palette.text}
            />
            <Txt variant="label" color={Palette.text}>
              {haircut.likes}
            </Txt>
          </Pressable>

          <View style={styles.socialItem}>
            <IconSymbol name="bubble.right" size={22} color={Palette.text} />
            <Txt variant="label" color={Palette.text}>
              {haircut.comments}
            </Txt>
          </View>

          <View style={styles.spacer} />

          <Pressable onPress={() => toggleBookmark(haircut.id)} hitSlop={8}>
            <IconSymbol
              name={haircut.bookmarked ? 'bookmark.fill' : 'bookmark'}
              size={22}
              color={haircut.bookmarked ? Palette.accent : Palette.text}
            />
          </Pressable>
        </View>

        {/* Basic info */}
        <Section>
          <Card>
            <View style={styles.basicRow}>
              <Image source={{ uri: stylist.avatarUrl }} style={styles.basicAvatar} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading">{haircut.cutType}</Txt>
                <Txt variant="label">{haircut.location}</Txt>
                <Txt variant="caption">{formatDate(haircut.date)}</Txt>
              </View>
            </View>
          </Card>
        </Section>

        {/* Private info toggle */}
        <Section>
          <Pressable style={styles.privateToggle} onPress={() => setShowPrivate((p) => !p)}>
            <IconSymbol name={showPrivate ? 'eye' : 'eye.slash'} size={18} color={Palette.accent} />
            <Txt variant="label" color={Palette.accent}>
              {showPrivate ? 'Hide private info' : 'Show private info'}
            </Txt>
          </Pressable>

          {showPrivate ? (
            <Card style={{ marginTop: Spacing.sm }}>
              <View style={styles.priceRow}>
                <Txt variant="label">Price</Txt>
                <Txt variant="body">{money(haircut.price)}</Txt>
              </View>
              <View style={styles.priceRow}>
                <Txt variant="label">Tip</Txt>
                <Txt variant="body" color={Palette.accent}>
                  {money(haircut.tip)}
                </Txt>
              </View>
              <View style={[styles.priceRow, styles.priceTotal]}>
                <Txt variant="label">Total</Txt>
                <Txt variant="heading">{money(haircut.price + haircut.tip)}</Txt>
              </View>
            </Card>
          ) : null}
        </Section>

        {/* Stylist card */}
        <Section>
          <SectionTitle>Stylist</SectionTitle>
          <Card>
            <View style={styles.stylistHeader}>
              <View>
                <Image source={{ uri: stylist.avatarUrl }} style={styles.stylistAvatar} />
                {stylist.verified ? (
                  <View style={styles.verifiedBadge}>
                    <IconSymbol name="checkmark.seal.fill" size={18} color={Palette.accent} />
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.nameRow}>
                  <Txt variant="heading">{stylist.name}</Txt>
                  {stylist.verified ? (
                    <View style={styles.proBadge}>
                      <Txt variant="caption" color={Palette.accent}>
                        PRO
                      </Txt>
                    </View>
                  ) : null}
                </View>
                {stylist.handle ? <Txt variant="label">{stylist.handle}</Txt> : null}
                {stylist.totalCuts > 0 ? (
                  <View style={styles.statsRow}>
                    <IconSymbol name="star.fill" size={12} color={Palette.accent} />
                    <Txt variant="caption">{stylist.rating.toFixed(1)}</Txt>
                    <Txt variant="caption">· {stylist.totalCuts.toLocaleString()} cuts</Txt>
                  </View>
                ) : null}
              </View>

              <Pressable style={styles.bookButton}>
                <Txt variant="label" color={Palette.black} style={styles.bookText}>
                  Book
                </Txt>
              </Pressable>
            </View>

            {stylist.specialties.length > 0 ? (
              <View style={styles.tagRow}>
                {stylist.specialties.map((s) => (
                  <Pill key={s} label={s} />
                ))}
              </View>
            ) : null}

            {stylist.bio ? (
              <Txt variant="label" style={styles.bio}>
                {stylist.bio}
              </Txt>
            ) : null}
          </Card>
        </Section>

        {/* Specifications */}
        <Section>
          <SectionTitle>Specifications</SectionTitle>
          <Card>
            <View style={styles.lengthGrid}>
              <LengthCell label="Top" value={haircut.lengthTop || '—'} />
              <LengthCell label="Sides" value={haircut.lengthSides || '—'} />
              <LengthCell label="Back" value={haircut.lengthBack || '—'} />
            </View>

            <Txt variant="caption" style={styles.specLabel}>
              Techniques
            </Txt>
            <View style={styles.tagRow}>
              {haircut.techniques.length > 0 ? (
                haircut.techniques.map((t) => <Pill key={t} label={t} />)
              ) : (
                <Txt variant="label">—</Txt>
              )}
            </View>

            <Txt variant="caption" style={styles.specLabel}>
              Tools
            </Txt>
            <View style={styles.tagRow}>
              {haircut.tools.length > 0 ? (
                haircut.tools.map((t) => <Pill key={t} label={t} />)
              ) : (
                <Txt variant="label">—</Txt>
              )}
            </View>
          </Card>
        </Section>

        {/* Notes */}
        <Section>
          <SectionTitle>Notes</SectionTitle>
          <Card>
            <Txt variant="label" color={Palette.textMuted}>
              My Notes
            </Txt>
            <Txt variant="body" style={styles.noteBody}>
              {haircut.publicNotes || '—'}
            </Txt>

            {showPrivate ? (
              <>
                <View style={styles.noteLabelRow}>
                  <IconSymbol name="lock.fill" size={12} color={Palette.accent} />
                  <Txt variant="label" color={Palette.accent}>
                    Private Notes
                  </Txt>
                </View>
                <Txt variant="body" style={styles.noteBody}>
                  {haircut.privateNotes || '—'}
                </Txt>
              </>
            ) : null}

            {haircut.stylistNotes ? (
              <>
                <View style={styles.noteLabelRow}>
                  <Txt variant="label" color={Palette.textMuted}>
                    Stylist Notes
                  </Txt>
                  <View style={styles.proBadge}>
                    <Txt variant="caption" color={Palette.accent}>
                      PRO
                    </Txt>
                  </View>
                </View>
                <Txt variant="body" style={styles.noteBody}>
                  {haircut.stylistNotes}
                </Txt>
              </>
            ) : null}
          </Card>
        </Section>

        {/* Grow-out timeline */}
        <Section>
          <SectionTitle>Timeline</SectionTitle>
          <Txt variant="caption" style={{ marginBottom: Spacing.md }}>
            Track how this cut grew out — add the next-day look and updates over the weeks.
          </Txt>
          <UpdateTimeline haircutId={haircut.id} />
        </Section>

        {/* Delete */}
        <Section style={{ marginBottom: Spacing.xxl }}>
          <Pressable style={styles.deleteButton} onPress={confirmDelete}>
            <IconSymbol name="trash" size={16} color={Palette.accent} />
            <Txt variant="label" color={Palette.accent}>
              Delete haircut
            </Txt>
          </Pressable>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Gallery({ photos }: { photos: Photo[] }) {
  const { width } = useWindowDimensions();
  const isDesktop = useIsDesktop();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  // Cap the photo size on desktop so it doesn't fill a huge window.
  const size = isDesktop ? 460 : width;

  if (photos.length === 0) {
    return <View style={[styles.photo, { width: size, height: size, alignSelf: 'center' }]} />;
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / size));
  }

  function go(delta: number) {
    const next = Math.min(Math.max(index + delta, 0), photos.length - 1);
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * size, animated: true });
  }

  const current = photos[Math.min(index, photos.length - 1)];
  // On web there's no swipe gesture, so show clickable arrows on hover.
  const showArrows = Platform.OS === 'web' && photos.length > 1;

  return (
    <View
      style={{ width: size, alignSelf: 'center' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onScroll}>
        {photos.map((photo) => (
          <View key={photo.id} style={{ width: size, height: size }}>
            <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
            <View style={styles.angleTag}>
              <Txt variant="caption" color={Palette.text}>
                {angleLabel(photo.angle)}
              </Txt>
            </View>
          </View>
        ))}
      </ScrollView>

      {showArrows && index > 0 ? (
        <Pressable
          style={[styles.navArrow, styles.navLeft, { top: size / 2 - 20, opacity: hovered ? 1 : 0 }]}
          onPress={() => go(-1)}>
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
      ) : null}
      {showArrows && index < photos.length - 1 ? (
        <Pressable
          style={[styles.navArrow, styles.navRight, { top: size / 2 - 20, opacity: hovered ? 1 : 0 }]}
          onPress={() => go(1)}>
          <IconSymbol name="chevron.right" size={26} color={Palette.text} />
        </Pressable>
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.dots}>
          {photos.map((p, i) => (
            <View key={p.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      {current.note ? (
        <Txt variant="label" style={styles.photoNote}>
          {current.note}
        </Txt>
      ) : null}
    </View>
  );
}

function Header({
  onBack,
  onEdit,
}: {
  onBack: () => void;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8}>
        <IconSymbol name="chevron.left" size={26} color={Palette.text} />
      </Pressable>
      <Txt variant="heading">Haircut Details</Txt>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={8}>
          <IconSymbol name="pencil" size={20} color={Palette.text} />
        </Pressable>
      ) : (
        <View style={{ width: 22 }} />
      )}
    </View>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.section, style]}>{children}</View>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Txt variant="label" color={Palette.textMuted} style={styles.sectionTitle}>
      {children}
    </Txt>
  );
}

function LengthCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.lengthCell}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="heading">{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.black },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: Palette.surfaceAlt,
  },
  angleTag: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  dotActive: { backgroundColor: Palette.accent },
  navArrow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: Spacing.sm },
  navRight: { right: Spacing.sm },
  photoNote: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    fontStyle: 'italic',
  },
  socialBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  socialItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  spacer: { flex: 1 },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  basicRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  basicAvatar: { width: 48, height: 48, borderRadius: Radius.md },
  privateToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  priceTotal: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.border,
  },
  stylistHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stylistAvatar: { width: 56, height: 56, borderRadius: Radius.pill },
  verifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  proBadge: {
    backgroundColor: Palette.accentSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  bookButton: {
    backgroundColor: Palette.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  bookText: { fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  bio: { marginTop: Spacing.md, lineHeight: 20 },
  lengthGrid: { flexDirection: 'row', gap: Spacing.sm },
  lengthCell: {
    flex: 1,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  specLabel: { marginTop: Spacing.lg },
  noteBody: { marginTop: Spacing.xs, marginBottom: Spacing.md, lineHeight: 20 },
  noteLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
});
