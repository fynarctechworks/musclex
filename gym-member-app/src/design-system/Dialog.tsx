import type { ReactNode } from 'react';
import { Modal, Pressable } from 'react-native';
import { Txt } from './Text';
import { elevation } from './tokens';

/**
 * Centred modal dialog (design.md Level 5 elevation) for confirmations and short
 * forms that shouldn't navigate away. For destructive OS-native confirms, prefer
 * `Alert.alert`; use this when the body needs custom content.
 */
export function Dialog({
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
        className="flex-1 items-center justify-center bg-black/60 px-lg"
      >
        <Pressable
          onPress={() => {}}
          accessibilityViewIsModal
          accessibilityRole="none"
          className="w-full rounded-xl border border-hairline bg-surface p-lg"
          style={elevation.modal}
        >
          {title ? (
            <Txt variant="display-sm" weight="600" className="mb-sm text-ink">
              {title}
            </Txt>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
