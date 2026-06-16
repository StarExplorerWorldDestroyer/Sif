import { Pressable, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Txt } from '@/components/ui/text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { useSocial } from '@/store/social';
import type { ConnectionStatus } from '@/types';

/**
 * Connect (mutual) + Follow (one-way) controls for another user.
 * Renders nothing when viewing yourself or when signed out.
 */
export function RelationshipButtons({ userId }: { userId: string }) {
  const { user } = useAuth();
  const { connectionStatus, isFollowing, follow, unfollow, requestConnection, acceptConnection, removeConnection } =
    useSocial();

  if (!user || user.id === userId) return null;

  const status = connectionStatus(userId);
  const following = isFollowing(userId);

  return (
    <View style={styles.row}>
      <ConnectButton
        status={status}
        onRequest={() => requestConnection(userId)}
        onAccept={() => acceptConnection(userId)}
        onRemove={() => removeConnection(userId)}
      />
      <Pressable
        style={[styles.btn, following ? styles.btnOutline : styles.btnFilled]}
        onPress={() => (following ? unfollow(userId) : follow(userId))}>
        <Txt variant="label" color={following ? Palette.text : Palette.black} style={styles.btnText}>
          {following ? 'Following' : 'Follow'}
        </Txt>
      </Pressable>
    </View>
  );
}

function ConnectButton({
  status,
  onRequest,
  onAccept,
  onRemove,
}: {
  status: ConnectionStatus;
  onRequest: () => void;
  onAccept: () => void;
  onRemove: () => void;
}) {
  if (status === 'connected') {
    return (
      <Pressable style={[styles.btn, styles.btnOutline]} onPress={onRemove}>
        <IconSymbol name="checkmark" size={14} color={Palette.success} />
        <Txt variant="label" color={Palette.text} style={styles.btnText}>
          Connected
        </Txt>
      </Pressable>
    );
  }
  if (status === 'pending_outgoing') {
    return (
      <Pressable style={[styles.btn, styles.btnOutline]} onPress={onRemove}>
        <Txt variant="label" color={Palette.textMuted} style={styles.btnText}>
          Requested
        </Txt>
      </Pressable>
    );
  }
  if (status === 'pending_incoming') {
    return (
      <Pressable style={[styles.btn, styles.btnFilled]} onPress={onAccept}>
        <Txt variant="label" color={Palette.black} style={styles.btnText}>
          Accept
        </Txt>
      </Pressable>
    );
  }
  return (
    <Pressable style={[styles.btn, styles.btnFilled]} onPress={onRequest}>
      <Txt variant="label" color={Palette.black} style={styles.btnText}>
        Connect
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    minWidth: 110,
  },
  btnFilled: { backgroundColor: Palette.accent },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Palette.border,
  },
  btnText: { fontWeight: '600' },
});
