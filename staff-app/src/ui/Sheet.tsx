import React from 'react';
import { View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';
import { tokens } from '@/ui/tokens';

/**
 * Sheet — the modal surface for filters, pickers and secondary actions.
 *
 * Distinct from Dialog: a Dialog INTERRUPTS and demands a decision; a Sheet
 * offers optional refinement and can be dismissed by dragging. Filters,
 * sort options and "more actions" belong here — confirmations do not.
 *
 * Uses @gorhom/bottom-sheet, which is JS-only (built on reanimated +
 * gesture-handler, both already present), so it needs no native rebuild.
 */
export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Snap heights as % of screen. One stop is usually right on a phone. */
  snapPoints?: string[];
  children: React.ReactNode;
};

export function Sheet({ open, onClose, title, snapPoints = ['55%'], children }: SheetProps) {
  const ref = React.useRef<BottomSheet>(null);

  React.useEffect(() => {
    if (open) ref.current?.expand();
    else ref.current?.close();
  }, [open]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      // pressBehavior="close": tapping the scrim dismisses. A sheet that traps
      // you is a dialog wearing the wrong clothes.
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={ref}
      index={open ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: tokens.card }}
      handleIndicatorStyle={{ backgroundColor: tokens.border }}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {title ? (
          <Text className="pb-3 text-lg font-semibold text-foreground">{title}</Text>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

/**
 * FilterSheet — the standard filter surface for every list screen.
 *
 * The web app puts filters in a toolbar row; on a phone that row would eat a
 * third of the viewport, so filters live behind a button and the ACTIVE COUNT
 * is shown on that button. Hidden filters that silently narrow a list are how
 * staff conclude "the member isn't in the system".
 */
export function FilterSheet({
  open, onClose, onClear, children, activeCount = 0,
}: {
  open: boolean;
  onClose: () => void;
  onClear?: () => void;
  children: React.ReactNode;
  activeCount?: number;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <View className="gap-4">
        {children}
        {activeCount > 0 && onClear ? (
          <Text
            accessibilityRole="button"
            onPress={onClear}
            className="pt-2 text-sm font-medium text-destructive">
            Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}
