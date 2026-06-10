import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { Txt, useThemeColors } from '../../../design-system';
import { ITEM_HEIGHT, VISIBLE, Wheel, type WheelItem } from './Wheel';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MIN_AGE = 13;
const MAX_AGE = 100;

const GAP = 10;
const BAND_TOP = ((VISIBLE - 1) / 2) * ITEM_HEIGHT;

/** Days in a given month/year (handles leap years). */
function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Date-of-birth picker — three snapping wheels (day / month / year). Emits an ISO
 * `YYYY-MM-DD`. Year range is bounded so age stays 13–100; the day wheel clamps
 * to the selected month's length. Age is derived by the caller from the ISO.
 */
export function DobPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (iso: string) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Parse current value, defaulting to a sensible 25-year-old birthdate.
  const parsed = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
      if (y && m && d) return { y, m, d };
    }
    return { y: currentYear - 25, m: 1, d: 1 };
  }, [value, currentYear]);

  const years = useMemo<WheelItem<number>[]>(
    () =>
      Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => {
        const yr = currentYear - MIN_AGE - i;
        return { value: yr, label: String(yr) };
      }),
    [currentYear],
  );

  const months: WheelItem<number>[] = MONTHS.map((label, i) => ({ value: i + 1, label }));

  const maxDay = daysInMonth(parsed.y, parsed.m);
  const days: WheelItem<number>[] = Array.from({ length: maxDay }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));

  const emit = (y: number, m: number, d: number) => {
    const clampedDay = Math.min(d, daysInMonth(y, m));
    onChange(`${y}-${pad2(m)}-${pad2(clampedDay)}`);
  };

  const theme = useThemeColors();

  // Size the columns from the OWN measured width — not the window — so the wheels
  // always sit inside their padded container. Trusting `useWindowDimensions` made
  // the band overflow both margins (and clipped the day/year digits) whenever the
  // window was wider than the rendered frame (e.g. web preview).
  const [boxW, setBoxW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setBoxW(e.nativeEvent.layout.width);
  const colW = boxW > 0 ? Math.floor((boxW - GAP * 2) / 3) : 0;

  return (
    <View className="px-lg" style={{ alignSelf: 'stretch' }}>
      <View style={{ alignSelf: 'stretch' }} onLayout={onLayout}>
        {colW > 0 ? (
        <>
          {/* Column labels — a separate row so the wheels below share one band. */}
          <View className="mb-sm flex-row justify-between">
            <Txt variant="body-sm" weight="500" className="text-center text-mute" style={{ width: colW }}>
              Day
            </Txt>
            <Txt variant="body-sm" weight="500" className="text-center text-mute" style={{ width: colW }}>
              Month
            </Txt>
            <Txt variant="body-sm" weight="500" className="text-center text-mute" style={{ width: colW }}>
              Year
            </Txt>
          </View>

          {/* Wheels + ONE continuous selection band drawn behind all three. */}
          <View className="relative flex-row justify-between">
            <View
              pointerEvents="none"
              className="absolute left-0 right-0 rounded-lg"
              style={{
                top: BAND_TOP,
                height: ITEM_HEIGHT,
                backgroundColor: theme.accentSoft,
                borderWidth: 1,
                borderColor: theme.primary,
              }}
            />
            <Wheel
              band={false}
              items={days}
              value={Math.min(parsed.d, maxDay)}
              onChange={(d) => emit(parsed.y, parsed.m, d)}
              width={colW}
            />
            <Wheel band={false} items={months} value={parsed.m} onChange={(m) => emit(parsed.y, m, parsed.d)} width={colW} />
            <Wheel band={false} items={years} value={parsed.y} onChange={(y) => emit(y, parsed.m, parsed.d)} width={colW} />
          </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
