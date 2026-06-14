import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Txt } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Palette, Spacing } from '@/constants/theme';

export default function ExploreScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Txt variant="title">Explore</Txt>
      </View>
      <View style={styles.center}>
        <IconSymbol name="safari" size={48} color={Palette.textDim} />
        <Txt variant="heading" style={styles.title}>
          Coming soon
        </Txt>
        <Txt variant="label" style={styles.text}>
          Discover haircuts from the community and find new stylists near you.
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
