import {
  Activity,
  Add,
  ArrowRight2,
  Award,
  Book1,
  Calendar,
  Card,
  Chart2,
  Clock,
  Cup,
  Danger,
  Drop,
  Flash,
  Health,
  Home2,
  Location,
  LogoutCurve,
  Medal,
  MessageText1,
  Note1,
  People,
  Profile,
  Refresh,
  Ruler,
  ScanBarcode,
  Star1,
  TickCircle,
  Weight,
} from 'iconsax-react-native';
import { color } from './theme';

/**
 * Semantic icon layer over Iconsax.
 *
 * Screens name what an icon MEANS, never which vendor glyph it is, so swapping
 * icon sets is one file rather than thirty. Iconsax's `variant` is fixed per
 * usage here: filled for the active tab, outline everywhere else, because
 * mixing weights in one row is what makes an icon set look assembled rather
 * than chosen.
 */

const GLYPHS = {
  today: Home2,
  gym: Weight,
  progress: Chart2,
  me: Profile,
  add: Add,
  chevron: ArrowRight2,
  classes: Calendar,
  nutrition: Note1,
  community: People,
  coach: Flash,
  messages: MessageText1,
  exercises: Book1,
  membership: Card,
  plan: Award,
  visits: Clock,
  tools: Ruler,
  referral: Cup,
  body: Health,
  goals: Medal,
  water: Drop,
  streak: Activity,
  star: Star1,
  check: TickCircle,
  alert: Danger,
  retry: Refresh,
  signout: LogoutCurve,
  location: Location,
  scan: ScanBarcode,
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 22,
  tone = 't2',
  filled = false,
}: {
  name: IconName;
  size?: number;
  tone?: 't1' | 't2' | 't3' | 't4' | 'accent' | 'good' | 'inverse';
  filled?: boolean;
}) {
  const Glyph = GLYPHS[name];
  const tint =
    tone === 'accent'
      ? color.accent
      : tone === 'good'
        ? color.good
        : tone === 'inverse'
          ? color.accentInk
          : color[tone];

  return <Glyph size={size} color={tint} variant={filled ? 'Bold' : 'Linear'} />;
}
