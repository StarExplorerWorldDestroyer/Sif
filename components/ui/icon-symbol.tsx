// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  scissors: 'content-cut',
  safari: 'explore',
  'person.fill': 'person',
  plus: 'add',
  'arrow.up.right': 'trending-up',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'bubble.right': 'chat-bubble-outline',
  'chevron.left': 'chevron-left',
  'square.and.arrow.up': 'ios-share',
  'bookmark': 'bookmark-border',
  'bookmark.fill': 'bookmark',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'lock.fill': 'lock',
  'checkmark.seal.fill': 'verified',
  'star.fill': 'star',
  'xmark': 'close',
  'pencil': 'edit',
  'trash': 'delete',
  'gearshape': 'settings',
  'gearshape.fill': 'settings',
  'checkmark': 'check',
  'sparkles': 'auto-awesome',
  'line.3.horizontal.decrease': 'filter-list',
  'bell': 'notifications-none',
  'bell.fill': 'notifications',
  'person.2.fill': 'group',
  'link': 'link',
  'globe': 'public',
  'camera.fill': 'photo-camera',
  'clock': 'schedule',
  'chart.bar': 'bar-chart',
  'calendar': 'event',
  'minus': 'remove',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
