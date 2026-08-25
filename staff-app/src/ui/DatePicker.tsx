import React from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar as CalendarIcon, Clock } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { formatDate, formatTime } from '@/lib/format';
import { tokens } from '@/ui/tokens';

/**
 * Date / time / range pickers over the platform-native picker.
 *
 * A native picker is used rather than a custom wheel because staff enter dates
 * constantly (expiries, session times, payment dates) and muscle memory for the
 * OS control beats anything bespoke.
 *
 * Android shows the picker as a one-shot modal and fires `dismissed`; iOS keeps
 * it inline. Both paths are handled here so screens never deal with it.
 */
type Mode = 'date' | 'time';

function useNativePicker(mode: Mode, value: Date, onChange: (d: Date) => void) {
  const [visible, setVisible] = React.useState(false);

  const handle = React.useCallback(
    (event: { type: string }, selected?: Date) => {
      // Android: 'dismissed' means cancel — keep the previous value.
      if (Platform.OS === 'android') setVisible(false);
      if (event.type === 'dismissed' || !selected) return;
      onChange(selected);
    },
    [onChange],
  );

  const picker = visible ? (
    <DateTimePicker
      value={value}
      mode={mode}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      onChange={handle}
    />
  ) : null;

  return { visible, setVisible, picker };
}

export function DateField({
  label, value, onChange, testID,
}: { label: string; value: Date; onChange: (d: Date) => void; testID?: string }) {
  const { visible, setVisible, picker } = useNativePicker('date', value, onChange);
  return (
    <View className="gap-1" testID={testID}>
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Button variant="outline" onPress={() => setVisible((v) => !v)}>
        <CalendarIcon size={16} color={tokens.foreground} />
        <Text>{formatDate(value)}</Text>
      </Button>
      {visible && Platform.OS === 'ios' ? <View className="items-center">{picker}</View> : picker}
    </View>
  );
}

export function TimeField({
  label, value, onChange, testID,
}: { label: string; value: Date; onChange: (d: Date) => void; testID?: string }) {
  const { visible, setVisible, picker } = useNativePicker('time', value, onChange);
  return (
    <View className="gap-1" testID={testID}>
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Button variant="outline" onPress={() => setVisible((v) => !v)}>
        <Clock size={16} color={tokens.foreground} />
        <Text>{formatTime(value)}</Text>
      </Button>
      {visible && Platform.OS === 'ios' ? <View className="items-center">{picker}</View> : picker}
    </View>
  );
}

export type DateRange = { from: Date; to: Date };

/**
 * DateRangeField — two bound dates.
 *
 * Enforces from <= to by pushing the other end rather than showing a validation
 * error. An inverted range silently returns zero rows, and "no payments this
 * period" is a dangerous thing to display when the truth is a bad filter.
 */
export function DateRangeField({
  value, onChange,
}: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <DateField
          label="From"
          value={value.from}
          onChange={(from) => onChange({ from, to: from > value.to ? from : value.to })}
        />
      </View>
      <View className="flex-1">
        <DateField
          label="To"
          value={value.to}
          onChange={(to) => onChange({ from: to < value.from ? to : value.from, to })}
        />
      </View>
    </View>
  );
}
