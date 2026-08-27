import { Platform, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/**
 * ────────────────────────────────────────────────────────────────
 * ICONS — SF Symbols
 * ────────────────────────────────────────────────────────────────
 *
 * Screens name what an icon MEANS, never which glyph it is, so the vendor is a
 * single file rather than thirty. That layer is why moving off Iconsax onto
 * Apple's own set touched no screen at all.
 *
 * SF Symbols are drawn by the system rather than shipped as an icon font, so
 * they carry the platform's optical sizing and weight, they align on the text
 * baseline the way a native app's do, and they follow whatever Apple ships next
 * without a bundle change. Nothing in an icon font can match that on iOS.
 *
 * Every name below was checked against the catalogue in SF Symbols 8.0 —
 * `symbols_with_enhanced_keywords.plist` inside the app bundle — rather than
 * guessed. Two first choices did not survive that check: there is no `whistle`
 * for a coach and no `rosette` for a plan.
 *
 * ONE GLYPH, ONE MEANING. The map is asserted to be injective in the tests: the
 * eye learns a symbol means one thing, and an interface where it means three
 * reads as assembled from whatever was to hand.
 */

const SYMBOLS = {
  today: 'house',
  gym: 'dumbbell',
  progress: 'chart.line.uptrend.xyaxis',
  me: 'person',
  add: 'plus',
  chevron: 'chevron.right',
  classes: 'calendar',
  nutrition: 'fork.knife',
  community: 'person.2',
  /** No `whistle` exists. A verified person is the nearest true thing. */
  coach: 'person.crop.circle.badge.checkmark',
  messages: 'bubble.left',
  exercises: 'book',
  membership: 'creditcard',
  /** Distinct from `routine` and `assigned` on purpose — all three are lists. */
  plan: 'list.clipboard',
  visits: 'clock',
  tools: 'ruler',
  referral: 'gift',
  body: 'heart.text.square',
  goals: 'medal',
  water: 'drop',
  streak: 'flame',
  info: 'info.circle',
  star: 'star',
  check: 'checkmark.circle',
  alert: 'exclamationmark.triangle',
  retry: 'arrow.clockwise',
  signout: 'rectangle.portrait.and.arrow.right',
  location: 'location',
  scan: 'qrcode.viewfinder',

  kudos: 'hand.thumbsup',
  badge: 'medal.star',
  locked: 'lock',
  import: 'square.and.arrow.down',

  photos: 'photo.on.rectangle',
  calendar: 'calendar.badge.checkmark',
  target: 'flag',
  clubs: 'person.3',
  challenge: 'trophy',
  feed: 'square.stack',
  findPeople: 'person.badge.plus',
  routine: 'list.bullet.clipboard',
  assigned: 'checklist',

  /** Routine row actions. `more` opens the ones that are not Start. */
  share: 'square.and.arrow.up',
  edit: 'pencil',
  trash: 'trash',
  more: 'ellipsis',
  /** Reordering a routine's exercises. */
  up: 'arrow.up',
  down: 'arrow.down',
} as const;

export type IconName = keyof typeof SYMBOLS;

/** Exported for the test that asserts no two names share a symbol. */
export const ICON_SYMBOLS = SYMBOLS;

/**
 * Which of the symbols above actually ship a solid cut.
 *
 * SF Symbols treats a fill as a SEPARATE NAME — `house` and `house.fill` — not
 * as a weight, so asking for a heavier weight does not produce one. Only 23 of
 * the 43 have a `.fill`, and naming one that does not exist renders nothing at
 * all, so the set is enumerated rather than assumed. Checked against the 8.0
 * catalogue; re-run that check if a symbol here changes.
 */
const HAS_FILL = new Set<IconName>([
  'today', 'gym', 'me', 'community', 'exercises', 'plan', 'visits', 'referral',
  'body', 'water', 'streak', 'info', 'star', 'check', 'alert', 'location',
  'kudos', 'locked', 'import', 'target', 'clubs', 'feed', 'routine',
]);

/**
 * The ink ladder, as literals.
 *
 * SymbolView takes a colour, not a class — it renders a native view, and
 * uniwind has nothing to hand it. These are the same values as the tokens in
 * src/global.css and the test pins them together so they cannot drift.
 */
const TINT = {
  t1: '#0c0a09',
  t2: '#44403b',
  t3: '#79716b',
  t4: '#a6a09b',
  accent: '#c10007',
  good: '#11823b',
  inverse: '#ffffff',
} as const;

/**
 * An icon is decorative or meaningful, and the component makes you say which.
 *
 * The same glyph is both depending on context — a tick beside the word "Saved"
 * is decoration, the same tick alone in a row is the only thing telling you the
 * set is done. Screen readers announce the second and must skip the first, or
 * every labelled button reads its own name twice.
 *
 *   <Icon name="check" decorative />                 hidden from the reader
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
  tone?: keyof typeof TINT;
  filled?: boolean;
} & IconSemantics) {
  const tint = TINT[tone];

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

  /*
    SF Symbols are an Apple technology and exist only on Apple's platforms.
    Rather than ship a second icon set for the sake of Android and web — which
    would guarantee the two drift — those platforms get a tinted placeholder of
    the correct SIZE, so layout is identical everywhere and only the glyph is
    missing. Android is not a shipping target today; when it becomes one this is
    the single place that needs a real answer.
  */
  if (Platform.OS !== 'ios') {
    return (
      <View
        {...a11y}
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: tint,
          opacity: 0.25,
        }}
      />
    );
  }

  return (
    <View {...a11y} style={{ width: size, height: size }}>
      <SymbolView
        // The solid cut where the symbol has one — the active tab — and the
        // outline where it does not. Naming a .fill that does not exist renders
        // an empty view, so this can never be a blind concatenation.
        name={
          (filled && HAS_FILL.has(name)
            ? `${SYMBOLS[name]}.fill`
            : SYMBOLS[name]) as SymbolViewProps['name']
        }
        size={size}
        tintColor={tint}
        // Monochrome, always. A hierarchical or multicolour rendering pulls the
        // system's own palette in and stops the icon answering to our tokens.
        type="monochrome"
        weight="regular"
        fallback={
          <View style={{ width: size, height: size, backgroundColor: tint, opacity: 0.25 }} />
        }
      />
    </View>
  );
}
