import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/field';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Glow, Palette, Radius, Spacing } from '@/constants/theme';
import { useMoney } from '@/hooks/use-money';
import { useCenteredContent } from '@/hooks/use-responsive';
import {
  ServiceInput,
  createService,
  deleteService,
  fetchServices,
  updateService,
} from '@/lib/services';
import { useAuth } from '@/store/auth';
import { useFeedback } from '@/store/feedback';
import type { StylistService } from '@/types';

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 180];
const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30];

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

const EMPTY: ServiceInput = {
  name: '',
  description: '',
  durationMinutes: 60,
  price: 0,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  active: true,
  sortOrder: 0,
};

export default function ServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useFeedback();
  const money = useMoney();
  const centered = useCenteredContent(640);

  const [services, setServices] = useState<StylistService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StylistService | null>(null);
  const [draft, setDraft] = useState<ServiceInput | null>(null);
  const [priceText, setPriceText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const list = await fetchServices(user.id);
    setServices(list);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = useCallback(() => {
    setEditing(null);
    setDraft({ ...EMPTY, sortOrder: services.length });
    setPriceText('');
  }, [services.length]);

  const openEdit = useCallback((s: StylistService) => {
    setEditing(s);
    setDraft({
      name: s.name,
      description: s.description,
      durationMinutes: s.durationMinutes,
      price: s.price,
      bufferBeforeMinutes: s.bufferBeforeMinutes,
      bufferAfterMinutes: s.bufferAfterMinutes,
      active: s.active,
      sortOrder: s.sortOrder,
    });
    setPriceText(s.price ? String(s.price) : '');
  }, []);

  const close = useCallback(() => {
    setDraft(null);
    setEditing(null);
  }, []);

  const patch = useCallback((p: Partial<ServiceInput>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast('Give the service a name.', { tone: 'error' });
      return;
    }
    const price = Math.max(0, Number(priceText) || 0);
    const input: ServiceInput = { ...draft, name, price };
    setSaving(true);
    if (editing) await updateService(editing.id, input);
    else await createService(input);
    setSaving(false);
    close();
    load();
    toast(editing ? 'Service updated.' : 'Service added.', { tone: 'success' });
  }, [draft, priceText, editing, toast, close, load]);

  const remove = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    await deleteService(editing.id);
    setSaving(false);
    close();
    load();
    toast('Service removed.', { tone: 'success' });
  }, [editing, close, load, toast]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <IconSymbol name="chevron.left" size={26} color={Palette.text} />
        </Pressable>
        <Txt variant="heading">Services</Txt>
        <Pressable onPress={openNew} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add service">
          <IconSymbol name="plus" size={24} color={Palette.accent} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Palette.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, centered]} showsVerticalScrollIndicator={false}>
          <Txt variant="body" color={Palette.textMuted} style={styles.lead}>
            Build your menu. Each service sets how long it blocks your calendar, what it costs, and any
            prep or cleanup buffer around it.
          </Txt>

          {services.length === 0 ? (
            <Pressable style={styles.emptyCard} onPress={openNew} accessibilityRole="button">
              <IconSymbol name="scissors" size={28} color={Palette.textMuted} />
              <Txt variant="label" color={Palette.textMuted} style={{ textAlign: 'center' }}>
                No services yet. Tap to add your first one.
              </Txt>
            </Pressable>
          ) : (
            services.map((s) => (
              <Pressable key={s.id} style={styles.card} onPress={() => openEdit(s)} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
                      {s.name}
                    </Txt>
                    {!s.active ? (
                      <Txt variant="caption" color={Palette.textDim} style={styles.inactiveTag}>
                        Hidden
                      </Txt>
                    ) : null}
                  </View>
                  <Txt variant="caption" color={Palette.textMuted}>
                    {durationLabel(s.durationMinutes)}
                    {s.bufferBeforeMinutes || s.bufferAfterMinutes
                      ? ` · +${s.bufferBeforeMinutes + s.bufferAfterMinutes} min buffer`
                      : ''}
                  </Txt>
                </View>
                <Txt variant="body" mono color={Palette.accent}>
                  {money(s.price)}
                </Txt>
              </Pressable>
            ))
          )}

          {services.length > 0 ? (
            <Pressable style={styles.addRow} onPress={openNew} accessibilityRole="button">
              <IconSymbol name="plus" size={18} color={Palette.accent} />
              <Txt variant="label" color={Palette.accent}>
                Add a service
              </Txt>
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Txt variant="heading" style={{ marginBottom: Spacing.lg }}>
                {editing ? 'Edit service' : 'New service'}
              </Txt>

              {draft ? (
                <>
                  <Field
                    label="Name"
                    required
                    value={draft.name}
                    onChangeText={(t) => patch({ name: t })}
                    placeholder="e.g. Men's cut"
                  />
                  <Field
                    label="Description (optional)"
                    value={draft.description}
                    onChangeText={(t) => patch({ description: t })}
                    placeholder="What's included?"
                  />
                  <Field
                    label="Price"
                    value={priceText}
                    onChangeText={setPriceText}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />

                  <Txt variant="label" style={styles.fieldLabel}>
                    Duration
                  </Txt>
                  <View style={styles.pillRow}>
                    {DURATION_OPTIONS.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => patch({ durationMinutes: m })}
                        style={[styles.pill, m === draft.durationMinutes && styles.pillActive]}>
                        <Txt
                          variant="caption"
                          color={m === draft.durationMinutes ? Palette.black : Palette.textMuted}>
                          {durationLabel(m)}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>

                  <Txt variant="label" style={styles.fieldLabel}>
                    Buffer before
                  </Txt>
                  <View style={styles.pillRow}>
                    {BUFFER_OPTIONS.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => patch({ bufferBeforeMinutes: m })}
                        style={[styles.pill, m === draft.bufferBeforeMinutes && styles.pillActive]}>
                        <Txt
                          variant="caption"
                          color={m === draft.bufferBeforeMinutes ? Palette.black : Palette.textMuted}>
                          {m === 0 ? 'None' : `${m}m`}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>

                  <Txt variant="label" style={styles.fieldLabel}>
                    Buffer after
                  </Txt>
                  <View style={styles.pillRow}>
                    {BUFFER_OPTIONS.map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => patch({ bufferAfterMinutes: m })}
                        style={[styles.pill, m === draft.bufferAfterMinutes && styles.pillActive]}>
                        <Txt
                          variant="caption"
                          color={m === draft.bufferAfterMinutes ? Palette.black : Palette.textMuted}>
                          {m === 0 ? 'None' : `${m}m`}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.activeRow}>
                    <View style={{ flex: 1 }}>
                      <Txt variant="body">Bookable</Txt>
                      <Txt variant="caption" color={Palette.textMuted}>
                        Turn off to hide without deleting.
                      </Txt>
                    </View>
                    <Switch
                      value={draft.active}
                      onValueChange={(v) => patch({ active: v })}
                      trackColor={{ true: Palette.accent, false: Palette.surfaceAlt }}
                      thumbColor={Palette.text}
                    />
                  </View>

                  <Pressable
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    disabled={saving}
                    onPress={save}
                    accessibilityRole="button">
                    {saving ? (
                      <ActivityIndicator color={Palette.black} />
                    ) : (
                      <Txt variant="label" color={Palette.black} style={{ fontWeight: '700' }}>
                        {editing ? 'Save changes' : 'Add service'}
                      </Txt>
                    )}
                  </Pressable>

                  {editing ? (
                    <Pressable style={styles.deleteBtn} disabled={saving} onPress={remove} accessibilityRole="button">
                      <Txt variant="label" color="#FF6B6B">
                        Delete service
                      </Txt>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.deleteBtn} onPress={close} accessibilityRole="button">
                      <Txt variant="label" color={Palette.textMuted}>
                        Cancel
                      </Txt>
                    </Pressable>
                  )}
                </>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  lead: { marginBottom: Spacing.lg, lineHeight: 20 },
  emptyCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inactiveTag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  fieldLabel: { marginBottom: Spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceAlt,
  },
  pillActive: { backgroundColor: Palette.accent },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  saveBtn: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Glow.md,
  },
  deleteBtn: { paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xs },
});
