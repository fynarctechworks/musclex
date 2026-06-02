import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';

/**
 * Bottom sheet — tap-outside-to-dismiss, slides up from the bottom with a grabber
 * handle and a rounded top. Use for quick contextual actions: log set, pick a
 * plan, confirm a booking. For full-screen flows use a route instead.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — press to dismiss. */}
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/60">
        {/* Sheet — swallow presses so taps inside don't close it. */}
        <Pressable
          onPress={() => {}}
          className="rounded-t-2xl border-t border-hairline bg-canvas-soft px-lg pt-sm"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mb-md mt-xxs h-[5px] w-[40px] self-center rounded-full bg-hairline-strong" />
          {title ? (
            <Txt variant="display-sm" weight="600" className="mb-md text-ink">
              {title}
            </Txt>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
