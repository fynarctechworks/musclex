import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { tokens } from '@/ui/tokens';

/**
 * Toast — transient confirmation ("Payment recorded", "Member added").
 *
 * Built in-house on reanimated rather than adding a toast package: the whole
 * surface is a queue, a timer and an animated view, and a dependency here
 * would be more code to keep in SDK-sync than to own.
 *
 * Deliberate constraints:
 *  - Toasts confirm, they never ASK. Anything needing a decision is a Dialog,
 *    because a toast can be missed and a destructive action must not be.
 *  - Errors default to a longer dwell than successes — you glance past "saved",
 *    you need to read "card declined".
 *  - One at a time. Stacked toasts over a payment screen hide the thing the
 *    staff member is trying to read.
 */

export type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; variant: ToastVariant };

const ICONS: Record<ToastVariant, LucideIcon> = {
  success: CircleCheck,
  error: TriangleAlert,
  info: Info,
};
const TINTS: Record<ToastVariant, string> = {
  success: tokens.success,
  error: tokens.destructive,
  info: tokens.foreground,
};
const DWELL: Record<ToastVariant, number> = {
  success: 2500,
  error: 5000,
  info: 3000,
};

type ToastApi = { show: (message: string, variant?: ToastVariant) => void };
const ToastContext = React.createContext<ToastApi | null>(null);

/** Throws when used outside the provider — a silent no-op toast is worse. */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = React.useState<ToastItem | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = React.useRef(0);

  const show = React.useCallback((message: string, variant: ToastVariant = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    const item = { id: nextId.current++, message, variant };
    setToast(item);
    timer.current = setTimeout(() => setToast(null), DWELL[variant]);
  }, []);

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const api = React.useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView key={toast.id} item={toast} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ item }: { item: ToastItem }) {
  const insets = useSafeAreaInsets();
  const Icon = ICONS[item.variant];
  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      pointerEvents="none"
      // Sits above the tab bar, not over it — staff must still see where they are.
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 72 }}>
      <View
        accessibilityRole="alert"
        className={cn(
          'flex-row items-center gap-2 rounded-lg border border-border bg-card px-4 py-3',
        )}>
        <Icon size={18} color={TINTS[item.variant]} />
        <Text className="flex-1 text-sm text-foreground">{item.message}</Text>
      </View>
    </Animated.View>
  );
}
