import React from 'react';
import { View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { Text } from '@/components/ui/text';
import { tokens } from '@/ui/tokens';

/**
 * ScheduleCalendar — month view for classes, sessions and attendance.
 *
 * react-native-calendars is JS-only and themed here to the app's tokens rather
 * than left on its defaults, which are iOS-blue and would be the only place in
 * the app using a colour outside the palette.
 *
 * Dots, not counts: a month cell is far too small for a number to be read at a
 * glance, and staff use the month view to find WHICH days have activity, then
 * drill in. The count belongs on the day view.
 */
export type DayMark = { date: string; count: number; tone?: 'default' | 'warning' | 'danger' };

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ScheduleCalendar({
  selected, onSelect, marks = [], testID,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  marks?: DayMark[];
  testID?: string;
}) {
  const selectedISO = toISO(selected);

  const marked = React.useMemo(() => {
    const out: Record<string, object> = {};
    for (const m of marks) {
      const color =
        m.tone === 'danger' ? tokens.destructive
        : m.tone === 'warning' ? '#f5a623'
        : tokens.foreground;
      out[m.date] = { marked: m.count > 0, dotColor: color };
    }
    out[selectedISO] = {
      ...(out[selectedISO] ?? {}),
      selected: true,
      selectedColor: tokens.foreground,
    };
    return out;
  }, [marks, selectedISO]);

  return (
    <View testID={testID}>
      <Calendar
        current={selectedISO}
        markedDates={marked}
        onDayPress={(day: DateData) => onSelect(new Date(day.year, day.month - 1, day.day))}
        firstDay={1}
        enableSwipeMonths
        theme={{
          calendarBackground: tokens.card,
          dayTextColor: tokens.foreground,
          monthTextColor: tokens.foreground,
          textSectionTitleColor: tokens.mutedForeground,
          todayTextColor: tokens.destructive,
          selectedDayTextColor: '#ffffff',
          selectedDayBackgroundColor: tokens.foreground,
          arrowColor: tokens.foreground,
          textDisabledColor: tokens.border,
        }}
      />
      <Text className="px-2 pt-2 text-xs text-muted-foreground">
        Dots mark days with activity — tap a day for the schedule.
      </Text>
    </View>
  );
}
