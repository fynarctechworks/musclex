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
  InfoCircle,
  CalendarTick,
  ClipboardText,
  ClipboardTick,
  Flag,
  Gallery,
  Global,
  ImportCurve,
  Like1,
  Location,
  Lock1,
  LogoutCurve,
  Medal,
  MessageText1,
  Note1,
  People,
  Profile,
  Refresh,
  Ruler,
  ScanBarcode,
  MedalStar,
  Chart1,
  Rank,
  SearchNormal1,
  Star1,
  TickCircle,
  Weight,
} from 'iconsax-react-native';
import { View } from 'react-native';
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
  info: InfoCircle,
  star: Star1,
  check: TickCircle,
  alert: Danger,
  retry: Refresh,
  signout: LogoutCurve,
  location: Location,
  scan: ScanBarcode,

  /*
    Added to retire the emoji that were doing structural work: 👏 for kudos,
    🏅/🔒 on badges, 🏆 and 📥 in the session summary. Emoji render from
    whatever font the OS ships, so they ignore the theme, change shape between
    Android versions, and cannot take a tint — which is why they read as
    unfinished next to a real icon set.
  */
  kudos: Like1,
  badge: MedalStar,
  locked: Lock1,
  import: ImportCurve,

  /*
    One glyph, one meaning.

    Building the new hub tabs, a handful of icons were reused across unrelated
    rows because the set was smaller than the number of things that needed
    naming — "Progress photos" and "Training calendar" both ended up wearing
    the TODAY tab's icon, and "My routines", "Assigned plan" and "Challenges"
    all wore the same shield. On screen that reads as an interface assembled
    from whatever was to hand: the eye learns a glyph means one thing, then
    finds it meaning three.
  */
  photos: Gallery,
  calendar: CalendarTick,
  target: Flag,
  clubs: Global,
  challenge: Rank,
  feed: Chart1,
  findPeople: SearchNormal1,
  routine: ClipboardText,
  assigned: ClipboardTick,
} as const;

export type IconName = keyof typeof GLYPHS;

/**
 * An icon is decorative or meaningful, and the component makes you say which.
 *
 * The same glyph is both depending on context — a tick beside the word "Saved"
 * is decoration, the same tick alone in a row is the only thing telling you the
 * set is done. Screen readers announce the second and must skip the first, or
 * every labelled button reads its own name twice.
 *
 *   <Icon name="check" decorative />              hidden from the reader
 *   <Icon name="check" accessibilityLabel="Done" />  announced
 *
 * One of the two is required, so a new icon cannot quietly default to silence.
 */
type IconSemantics =
  | { decorative: true; accessibilityLabel?: never }
  | { decorative?: false; accessibilityLabel: string };

export function Icon({
  name,
  size = 22,
  tone = 't2',
  filled = false,
  ...semantics
}: {
  name: IconName;
  size?: number;
  tone?: 't1' | 't2' | 't3' | 't4' | 'accent' | 'good' | 'inverse';
  filled?: boolean;
} & IconSemantics) {
  const Glyph = GLYPHS[name];
  const tint =
    tone === 'accent'
      ? color.accent
      : tone === 'good'
        ? color.good
        : tone === 'inverse'
          ? color.accentInk
          : color[tone];

  /*
    Three platforms, three different props, and none of them is a superset:
    `accessibilityElementsHidden` is iOS only, `importantForAccessibility` is
    Android only, and react-native-web reads neither — it wants `aria-hidden`.
    Setting only the first two hides decorative icons on the phones and leaves
    them announced on the web build, which is where this app is also shipped.
  */
  const a11y = semantics.decorative
    ? ({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
        'aria-hidden': true,
      } as const)
    : ({
        accessible: true,
        accessibilityRole: 'image',
        accessibilityLabel: semantics.accessibilityLabel,
        'aria-label': semantics.accessibilityLabel,
      } as const);

  return (
    <View {...a11y}>
      <Glyph size={size} color={tint} variant={filled ? 'Bold' : 'Linear'} />
    </View>
  );
}
