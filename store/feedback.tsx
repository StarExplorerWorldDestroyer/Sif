import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/ui/text';
import { FontSize, Palette, Radius, Spacing } from '@/constants/theme';

type Tone = 'info' | 'error' | 'success';
type ToastItem = { id: string; message: string; tone: Tone };

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
};

type ConfirmState = (ConfirmOptions & { resolve: (v: boolean) => void }) | null;

type PromptOptions = {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
};

type PromptState = (PromptOptions & { resolve: (v: string | null) => void }) | null;

type FeedbackValue = {
  /** Show a transient, themed message. Works on web and native. */
  toast: (message: string, opts?: { tone?: Tone }) => void;
  /** Show a themed confirm dialog. Resolves true on confirm, false otherwise. */
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Show a themed text-input dialog. Resolves the text, or null if cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

const FeedbackContext = createContext<FeedbackValue | null>(null);

let counter = 0;

/**
 * App-wide, cross-platform feedback: toasts and confirm dialogs. Replaces
 * React Native's Alert, which is effectively a no-op on web — meaning error
 * messages never showed and destructive confirmations silently did nothing.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [promptState, setPromptState] = useState<PromptState>(null);
  const [promptText, setPromptText] = useState('');
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (message: string, opts?: { tone?: Tone }) => {
      const id = `toast-${++counter}`;
      setToasts((prev) => [...prev, { id, message, tone: opts?.tone ?? 'info' }]);
      timers.current[id] = setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmState((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    setPromptText(opts.defaultValue ?? '');
    return new Promise<string | null>((resolve) => {
      setPromptState({ ...opts, resolve });
    });
  }, []);

  const closePrompt = useCallback((value: string | null) => {
    setPromptState((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <View style={styles.toastLayer} pointerEvents="box-none">
        {toasts.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => dismiss(t.id)}
            accessibilityRole="alert"
            style={[styles.toast, t.tone === 'error' && styles.toastError, t.tone === 'success' && styles.toastSuccess]}>
            <Txt variant="label" color={Palette.text} style={styles.toastText}>
              {t.message}
            </Txt>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={!!confirmState}
        transparent
        animationType="fade"
        onRequestClose={() => closeConfirm(false)}>
        <Pressable style={styles.backdrop} onPress={() => closeConfirm(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Txt variant="heading">{confirmState?.title}</Txt>
            {confirmState?.message ? (
              <Txt variant="label" color={Palette.textMuted} style={styles.dialogMessage}>
                {confirmState.message}
              </Txt>
            ) : null}
            <View style={styles.dialogActions}>
              <Pressable
                style={[styles.dialogBtn, styles.cancelBtn]}
                onPress={() => closeConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel={confirmState?.cancelLabel ?? 'Cancel'}>
                <Txt variant="label" color={Palette.textMuted}>
                  {confirmState?.cancelLabel ?? 'Cancel'}
                </Txt>
              </Pressable>
              <Pressable
                style={[styles.dialogBtn, styles.confirmBtn]}
                onPress={() => closeConfirm(true)}
                accessibilityRole="button"
                accessibilityLabel={confirmState?.confirmLabel ?? 'Confirm'}>
                <Txt variant="label" color={Palette.black} style={styles.confirmText}>
                  {confirmState?.confirmLabel ?? 'Confirm'}
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!promptState}
        transparent
        animationType="fade"
        onRequestClose={() => closePrompt(null)}>
        <Pressable style={styles.backdrop} onPress={() => closePrompt(null)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Txt variant="heading">{promptState?.title}</Txt>
            {promptState?.message ? (
              <Txt variant="label" color={Palette.textMuted} style={styles.dialogMessage}>
                {promptState.message}
              </Txt>
            ) : null}
            <TextInput
              value={promptText}
              onChangeText={setPromptText}
              placeholder={promptState?.placeholder}
              placeholderTextColor={Palette.textDim}
              multiline={promptState?.multiline}
              autoFocus
              style={[styles.promptInput, promptState?.multiline && styles.promptMultiline]}
            />
            <View style={styles.dialogActions}>
              <Pressable
                style={[styles.dialogBtn, styles.cancelBtn]}
                onPress={() => closePrompt(null)}
                accessibilityRole="button"
                accessibilityLabel={promptState?.cancelLabel ?? 'Cancel'}>
                <Txt variant="label" color={Palette.textMuted}>
                  {promptState?.cancelLabel ?? 'Cancel'}
                </Txt>
              </Pressable>
              <Pressable
                style={[styles.dialogBtn, styles.confirmBtn]}
                onPress={() => closePrompt(promptText)}
                accessibilityRole="button"
                accessibilityLabel={promptState?.confirmLabel ?? 'Save'}>
                <Txt variant="label" color={Palette.black} style={styles.confirmText}>
                  {promptState?.confirmLabel ?? 'Save'}
                </Txt>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside a FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 96,
    gap: Spacing.sm,
  },
  toast: {
    maxWidth: 440,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  toastError: { borderColor: Palette.accent },
  toastSuccess: { borderColor: Palette.success },
  toastText: { textAlign: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  dialogMessage: { lineHeight: 20 },
  promptInput: {
    marginTop: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Palette.text,
    fontSize: FontSize.md,
  },
  promptMultiline: { minHeight: 80, textAlignVertical: 'top' },
  dialogActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  dialogBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.pill, alignItems: 'center' },
  cancelBtn: { borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  confirmBtn: { backgroundColor: Palette.accent },
  confirmText: { fontWeight: '600' },
});
