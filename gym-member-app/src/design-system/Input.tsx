import { forwardRef } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { cssInterop } from 'nativewind';
import { Txt } from './Text';
import { useThemeColors } from './theme';
import { useFieldFocus } from './field-focus';

cssInterop(TextInput, { className: 'style' });

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, className, ...rest },
  ref,
) {
  const theme = useThemeColors();
  const { focusProps, fieldStyle } = useFieldFocus();
  return (
    <View className="w-full">
      {label ? (
        <Txt variant="body-sm" weight="500" className="text-body mb-xs">
          {label}
        </Txt>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={theme.mute}
        className={[
          'h-[48px] rounded-sm border bg-surface px-md text-body-md text-ink font-sans',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={fieldStyle(!!error)}
        {...focusProps}
        {...rest}
      />
      {error ? (
        <Txt variant="caption" className="text-error mt-xs">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" className="text-mute mt-xs">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});
