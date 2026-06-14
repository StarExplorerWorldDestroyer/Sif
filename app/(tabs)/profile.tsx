import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="title">Profile</Txt>
      </View>
      <View style={styles.center}>
        <IconSymbol name="person.fill" size={48} color={Palette.textDim} />
        <Txt variant="heading" style={styles.title}>
          Coming soon
        </Txt>
        <Txt variant="label" style={styles.text}>
          Your account, preferences, and saved stylists will live here.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  title: { color: Palette.textMuted },
  text: { textAlign: 'center', maxWidth: 260 },
});
