import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Label, Loading, Row, Txt } from '../src/ui';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { color, radius, space } from '../src/ui/theme';
import { buildMonth, intensity, shiftMonth, WEEKDAYS, type Cell } from '../src/lib/calendar';
import { useTrainingStats } from '../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * TRAINING CALENDAR
 * ────────────────────────────────────────────────────────────────
 *
 * A month at a time, each day shaded by how much work it held. The point is
 * the shape of a training block — where the gaps fell, whether last month was
 * heavier than this one — which a list of sessions cannot show.
 *
 * Built entirely from `activeDays` on the stats endpoint, so it needed no new
 * route. It does need the server to key days in the MEMBER's timezone, which
 * it now does: keyed in UTC, a 5am session in IST appeared on the day before,
 * and a calendar is exactly where that shows.
 */

/** A year of history: the most the endpoint will return. */
const WINDOW_DAYS = 365;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useTrainingStats(WINDOW_DAYS);

  const now = useMemo(() => new Date(), []);
  const [[year, month], setYm] = useState<[number, number]>([
    now.getFullYear(),
    now.getMonth(),
  ]);
  const [picked, setPicked] = useState<Cell | null>(null);

  const grid = useMemo(
    () => buildMonth(year, month, data?.activeDays ?? [], now),
    [year, month, data, now],
  );

  if (isLoading) return <Loading label="Loading your calendar" />;

  const go = (by: number) => {
    setYm(shiftMonth(year, month, by));
    setPicked(null);
  };

  // Nothing beyond the current month exists to look at yet.
  const atLatest = year === now.getFullYear() && month === now.getMonth();

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Calendar" />
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: 0,
          paddingBottom: 120,
          gap: space.md,
        }}
      >
        <Card>
          <Row>
            <Arrow label="Previous month" glyph="‹" onPress={() => go(-1)} />
            <Txt variant="heading">{grid.label}</Txt>
            <Arrow
              label="Next month"
              glyph="›"
              onPress={() => go(1)}
              disabled={atLatest}
            />
          </Row>

          <View style={{ flexDirection: 'row', marginTop: space.lg }}>
            {WEEKDAYS.map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Txt variant="caption" tone="t4">{d}</Txt>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
            {grid.cells.map((c, i) => (
              <Day
                key={c.key ?? `pad-${i}`}
                cell={c}
                selected={picked?.key === c.key}
                onPress={() => setPicked(c.sets > 0 || !c.future ? c : null)}
              />
            ))}
          </View>

          <Row style={{ marginTop: space.lg }}>
            <Txt variant="small" tone="t2">
              {grid.activeDays === 0
                ? 'Nothing logged this month.'
                : `${grid.activeDays} ${grid.activeDays === 1 ? 'day' : 'days'} trained`}
            </Txt>
            {grid.totalSets > 0 ? (
              <Txt variant="small" tone="t2">{grid.totalSets} sets</Txt>
            ) : null}
          </Row>
        </Card>

        {/* The selected day, rather than a popup — a sheet over a calendar
            hides the month you are trying to read. */}
        {picked ? (
          <Card>
            <Label>{formatPicked(picked, year, month)}</Label>
            <Txt variant="heading" style={{ marginTop: space.sm }}>
              {picked.sets > 0
                ? `${picked.sets} ${picked.sets === 1 ? 'set' : 'sets'}`
                : 'Rest day'}
            </Txt>
          </Card>
        ) : null}

        <Card>
          <Label>How to read it</Label>
          <Row style={{ marginTop: space.md, justifyContent: 'flex-start', gap: space.sm }}>
            <Txt variant="caption" tone="t3">Less</Txt>
            {[0, 1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: radius.sm - 3,
                  backgroundColor: shade(s as 0 | 1 | 2 | 3 | 4),
                  borderWidth: s === 0 ? 1 : 0,
                  borderColor: color.line,
                }}
              />
            ))}
            <Txt variant="caption" tone="t3">More</Txt>
          </Row>
          <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
            Each square is a day, shaded by how many sets you logged.
          </Txt>
        </Card>

        {data ? (
          <Card>
            <Label>Last 12 months</Label>
            <Row style={{ marginTop: space.md, alignItems: 'flex-end' }}>
              <View>
                <Txt variant="display">{data.activeDays.length}</Txt>
                <Txt variant="caption" tone="t3">days trained</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="display">{data.longestStreak}</Txt>
                <Txt variant="caption" tone="t3">longest streak</Txt>
              </View>
            </Row>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Intensity step → fill. Rest days are a well, not a colour. */
function shade(step: 0 | 1 | 2 | 3 | 4): string {
  if (step === 0) return color.surface2;
  return ['', 'rgba(225,6,0,0.16)', 'rgba(225,6,0,0.34)', 'rgba(225,6,0,0.62)', color.accent][
    step
  ];
}

function formatPicked(c: Cell, year: number, month: number): string {
  return new Date(year, month, c.day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function Day({
  cell,
  selected,
  onPress,
}: {
  cell: Cell;
  selected: boolean;
  onPress: () => void;
}) {
  if (!cell.key) return <View style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;

  const step = intensity(cell.sets);
  const dark = step >= 3;

  return (
    <View style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2.5 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          cell.future
            ? `${cell.day}, upcoming`
            : `${cell.day}, ${cell.sets > 0 ? `${cell.sets} sets` : 'rest day'}`
        }
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          flex: 1,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: shade(step),
          // Today is ringed rather than filled, so it reads even on a rest day.
          borderWidth: selected ? 2 : cell.today || step === 0 ? 1 : 0,
          borderColor: selected
            ? color.t1
            : cell.today
              ? color.accent
              : color.line,
          opacity: (cell.future ? 0.45 : 1) * (pressed ? 0.7 : 1),
        })}
      >
        <Txt
          variant="caption"
          tone={dark ? 't3' : cell.today ? 'accent' : 't2'}
          style={{
            fontWeight: cell.today ? '700' : '500',
            color: dark ? color.accentInk : undefined,
          }}
        >
          {cell.day}
        </Txt>
      </Pressable>
    </View>
  );
}

function Arrow({
  label,
  glyph,
  onPress,
  disabled,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        width: 34,
        height: 34,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.surface2,
        borderWidth: 1,
        borderColor: color.line,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Txt variant="body" tone="t2" style={{ fontWeight: '700' }}>{glyph}</Txt>
    </Pressable>
  );
}
