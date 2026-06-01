import type { ColorValue } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors } from './tokens';

export type IconName =
  | 'home'
  | 'dumbbell'
  | 'chart'
  | 'user'
  | 'qr'
  | 'bell'
  | 'chevron-right'
  | 'flame'
  | 'users'
  | 'check'
  | 'camera';

export function Icon({
  name,
  size = 24,
  color = colors.body,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  // Accept ColorValue so it can take react-navigation's tabBarIcon `color`.
  color?: ColorValue;
  strokeWidth?: number;
}) {
  const common = {
    stroke: color as string,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...common} />
          <Path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" {...common} />
        </>
      )}
      {name === 'dumbbell' && (
        <>
          <Path d="M6.5 6.5 17.5 17.5" {...common} />
          <Rect x="2.5" y="6" width="4" height="6" rx="1" {...common} />
          <Rect x="17.5" y="12" width="4" height="6" rx="1" {...common} />
          <Rect x="5" y="3.5" width="3" height="5" rx="1" {...common} />
          <Rect x="16" y="15.5" width="3" height="5" rx="1" {...common} />
        </>
      )}
      {name === 'chart' && (
        <>
          <Path d="M4 19V5" {...common} />
          <Path d="M4 19h16" {...common} />
          <Path d="m7 14 3-4 3 3 4-6" {...common} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8" r="4" {...common} />
          <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" {...common} />
        </>
      )}
      {name === 'qr' && (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1" {...common} />
          <Rect x="14" y="3" width="7" height="7" rx="1" {...common} />
          <Rect x="3" y="14" width="7" height="7" rx="1" {...common} />
          <Line x1="14" y1="14" x2="14" y2="21" {...common} />
          <Line x1="18" y1="14" x2="21" y2="14" {...common} />
          <Line x1="21" y1="18" x2="21" y2="21" {...common} />
          <Line x1="17" y1="18" x2="17" y2="21" {...common} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" {...common} />
          <Path d="M10 19a2 2 0 0 0 4 0" {...common} />
        </>
      )}
      {name === 'chevron-right' && <Path d="m9 6 6 6-6 6" {...common} />}
      {name === 'flame' && (
        <Path
          d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 2 3 3 3 6a5 5 0 0 1-10 0c0-4 5-6 5-13Z"
          {...common}
        />
      )}
      {name === 'users' && (
        <>
          <Circle cx="9" cy="8" r="3.5" {...common} />
          <Path d="M3 20c0-3 3-5 6-5s6 2 6 5" {...common} />
          <Path d="M16 5a3.5 3.5 0 0 1 0 7" {...common} />
          <Path d="M21 20c0-2.5-1.5-4.2-4-4.8" {...common} />
        </>
      )}
      {name === 'check' && <Path d="m5 13 4 4 10-11" {...common} />}
      {name === 'camera' && (
        <>
          <Path d="M4 8h3l2-2h6l2 2h3v11H4z" {...common} />
          <Circle cx="12" cy="13" r="3.5" {...common} />
        </>
      )}
    </Svg>
  );
}
