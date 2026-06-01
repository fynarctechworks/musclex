import { forwardRef } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { cssInterop } from 'nativewind';
import { Txt } from './Text';
import { colors } from './tokens';

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
  return (
    <View className="w-full">
      {label ? (
        <Txt variant="body-sm" weight="500" className="text-body mb-xs">
          {label}
        </Txt>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.mute}
        className={[
          'h-[48px] rounded-sm border bg-surface px-md text-body-md text-ink font-sans',
          error ? 'border-error' : 'border-hairline',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
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
