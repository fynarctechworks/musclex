import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  Home,
  Weight,
  Chart2,
  User,
  Calendar,
  Flash,
  ScanBarcode,
  Scan,
  Notification,
  ArrowRight2,
  ArrowLeft2,
  People,
  TickCircle,
  Camera,
  Warning2,
  Location,
  Call,
  Heart,
  Drop,
  Add,
  Gift,
  Medal,
  Category,
  Activity,
  More,
  Gallery,
  SearchNormal1,
  MessageText1,
  type Icon as IconsaxIcon,
} from 'iconsax-react-native';
import { useThemeColors } from './theme';

/**
 * App icon set — now backed by **Iconsax** (`iconsax-react-native`), default
 * variant **Linear**; `filled` (active/selected, e.g. focused tab or favorited
 * heart) renders the **Bold** variant. This stays a thin facade over the same
 * `<Icon name="…" />` API so every call site is untouched and every icon is
 * automatically theme-aware (defaults to the active theme's body colour).
 *
 * Named imports + the package's `sideEffects:false`/ESM `module` field let the
 * production bundle tree-shake to only the icons listed here (not all ~990).
 */
export type IconName =
  | 'home'
  | 'dumbbell'
  | 'chart'
  | 'user'
  | 'calendar'
  | 'flash'
  | 'qr'
  | 'scan'
  | 'bell'
  | 'chevron-right'
  | 'chevron-left'
  | 'flame'
  | 'footsteps'
  | 'users'
  | 'check'
  | 'camera'
  | 'alert'
  | 'pin'
  | 'phone'
  | 'heart'
  | 'drop'
  | 'add'
  | 'gift'
  | 'medal'
  | 'grid'
  | 'activity'
  | 'more'
  | 'gallery'
  | 'search'
  | 'message';

// Map our semantic names to the closest Iconsax glyph. `flame`/`footsteps` have
// no Iconsax equivalent, so they fall back to hand-drawn paths below (matched to
// the Linear stroke language).
const ICONSAX: Record<Exclude<IconName, 'flame' | 'footsteps'>, IconsaxIcon> = {
  home: Home,
  dumbbell: Weight, // Iconsax gym weight — closest to a dumbbell
  chart: Chart2,
  user: User,
  calendar: Calendar,
  flash: Flash,
  qr: ScanBarcode,
  scan: Scan, // square-frame scan — the centre check-in FAB glyph
  bell: Notification,
  'chevron-right': ArrowRight2,
  'chevron-left': ArrowLeft2,
  users: People,
  check: TickCircle,
  camera: Camera,
  alert: Warning2,
  pin: Location,
  phone: Call,
  heart: Heart,
  drop: Drop, // water / hydration
  add: Add, // plus — add a meal / entry
  gift: Gift, // rewards
  medal: Medal, // rewards / achievements
  grid: Category, // menu hub (all features)
  activity: Activity, // exercise / pulse line (BPM)
  more: More, // horizontal 3-dot overflow
  gallery: Gallery, // meal image placeholder
  search: SearchNormal1, // search tab
  message: MessageText1, // advice / coaching tab
};

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.75,
  filled = false,
}: {
  name: IconName;
  size?: number;
  // Accept ColorValue so it can take react-navigation's tabBarIcon `color`.
  color?: ColorValue;
  strokeWidth?: number;
  /** Render the Bold (filled) variant — used for active/selected states. */
  filled?: boolean;
}) {
  const theme = useThemeColors();
  // Default to the theme's secondary text colour so icons follow light/dark.
  const resolved = (color ?? theme.body) as string;

  // `flame` (streak / meal / challenges) — no Iconsax glyph, so keep a custom
  // path drawn in the same Linear stroke language.
  if (name === 'flame') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 2 3 3 3 6a5 5 0 0 1-10 0c0-4 5-6 5-13Z"
          stroke={resolved}
          strokeWidth={strokeWidth}
          fill={filled ? resolved : 'none'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // `footsteps` (step tracker) — no Iconsax glyph, so a custom two-print path in
  // the same Linear stroke language.
  if (name === 'footsteps') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M7 4.5c1.2 0 2 1.3 2 3.2 0 2-.7 3.8-2 3.8s-2-1.5-2-3.5S5.8 4.5 7 4.5Zm-.5 9.3h1c.8 0 1.4.7 1.3 1.5l-.4 3.1A1.4 1.4 0 0 1 7 19.6c-.8 0-1.4-.7-1.3-1.5l.3-2.8c.05-.4.1-1.5.5-1.5Z"
          stroke={resolved}
          strokeWidth={strokeWidth}
          fill={filled ? resolved : 'none'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M17 8.5c1.2 0 2 1.3 2 3.2 0 2-.7 3.8-2 3.8s-2-1.5-2-3.5S15.8 8.5 17 8.5Zm-.5 9.3h1c.8 0 1.4.7 1.3 1.5l-.3 2.1A1.4 1.4 0 0 1 17 22.6c-.8 0-1.4-.6-1.3-1.4l.2-1.9c.05-.4.2-1.5.6-1.5Z"
          stroke={resolved}
          strokeWidth={strokeWidth}
          fill={filled ? resolved : 'none'}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  const Glyph = ICONSAX[name];
  return <Glyph size={size} color={resolved} variant={filled ? 'Bold' : 'Linear'} />;
}
