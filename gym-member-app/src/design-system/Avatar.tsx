import { Image, View } from 'react-native';
import { Txt } from './Text';

/**
 * Circular avatar with an initial fallback. Used in the Home header and Profile
 * identity block. Pass `uri` for a photo; otherwise renders the first initial of
 * `name` on the inset surface (design.md surface-2 + hairline ring).
 */
export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
}) {
  const initial = (name ?? '').trim().slice(0, 1).toUpperCase() || '?';
  return (
    <View
      style={{ height: size, width: size, borderRadius: size / 2 }}
      className="items-center justify-center overflow-hidden border border-hairline bg-surface-2"
    >
      {uri ? (
        <Image source={{ uri }} style={{ height: size, width: size }} resizeMode="cover" />
      ) : (
        <Txt variant={size >= 56 ? 'display-md' : 'body-md'} weight="600" className="text-ink">
          {initial}
        </Txt>
      )}
    </View>
  );
}
