import { Platform } from 'react-native';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

/**
 * Web-only key handler for multiline composers: Enter submits, Shift+Enter
 * inserts a newline. A no-op on native (where the on-screen keyboard's return
 * key and submit behavior already apply), so it's safe to attach everywhere.
 *
 * Usage: <TextInput multiline onKeyPress={submitOnEnter(send)} />
 */
export function submitOnEnter(onSubmit: () => void) {
  return (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== 'web') return;
    const native = e.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (native.key === 'Enter' && !native.shiftKey) {
      (e as unknown as { preventDefault?: () => void }).preventDefault?.();
      onSubmit();
    }
  };
}
