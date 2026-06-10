import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';

/**
 * Bottom sheet — slides up from the bottom over a dimmed backdrop. The backdrop
 * FADES in/out independently of the sheet slide (so the dim doesn't wipe up with
 * the panel), and the sheet rides a spring for a natural settle. Tap outside or
 * the hardware back button to dismiss. KeyboardAvoidingView keeps inputs above the
 * keyboard. For full-screen flows use a route instead.
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
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 24, stiffness: 240, mass: 0.9, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: height, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, height]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Backdrop — fades independently of the sheet slide. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: Animated.multiply(fade, 0.5) }]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
          <Animated.View style={{ transform: [{ translateY }] }}>
            <View className="rounded-t-2xl bg-canvas px-lg pt-sm" style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="mb-md mt-xxs h-[5px] w-[40px] self-center rounded-full bg-hairline-strong" />
              {title ? (
                <Txt variant="display-sm" weight="600" className="mb-md text-ink">
                  {title}
                </Txt>
              ) : null}
              {children}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
