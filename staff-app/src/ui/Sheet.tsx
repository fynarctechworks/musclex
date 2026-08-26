import React from 'react';
import { View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Portal } from '@rn-primitives/portal';

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
 *
 * PORTALLED to the app root, because a bottom sheet lays out where it is
 * WRITTEN: one rendered inside a scrolling screen appears at the component's
 * scroll offset rather than the bottom of the window. The branch switcher
 * shipped exactly that bug — its sheet rendered clipped against the top of the
 * dashboard, leaving the branch list unreachable.
 *
 * Portalling removes the whole class, so callers no longer have to remember to
 * mount every sheet as a screen-root sibling. It reuses the SAME
 * `@rn-primitives/portal` host that already carries dialogs and popovers,
 * rather than `BottomSheetModal` — which is the library's own answer to this
 * but never presented in this app, while the portal host is proven working
 * here every run of `verify:ui`.
 *
 * The portal needs a name unique per sheet instance, or two open sheets would
 * fight over one slot.
 */
let sheetSeq = 0;
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
  const portalName = React.useRef(`sheet-${++sheetSeq}`).current;

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

  /*
   * Nothing in the portal host until it is needed: an always-mounted sheet per
   * screen would keep a full-window overlay alive behind every list.
   *
   * This early return MUST sit below every hook. Putting it above the
   * useCallback threw "Rendered more hooks than during the previous render"
   * and took the whole screen down — which is exactly what it did on the
   * first attempt at this.
   */
  if (!open) return null;

  return (
    <Portal name={portalName}>
      <BottomSheet
        ref={ref}
        index={0}
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
    </Portal>
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
