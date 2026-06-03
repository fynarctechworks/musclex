import { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { colors } from './tokens';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Pull-to-refresh handler (only with scroll). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Horizontal page padding. Default md (16px). */
  padded?: boolean;
  edges?: Edge[];
  className?: string;
}

export function Screen({
  children,
  scroll,
  onRefresh,
  refreshing,
  padded = true,
  edges = ['top'],
  className,
}: ScreenProps) {
  const pad = padded ? 'px-md' : '';
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.canvas} />
      {scroll ? (
        <ScrollView
          className={`flex-1 ${pad} ${className ?? ''}`}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          // Let taps on buttons fire even while the keyboard is open (otherwise the
          // first tap only dismisses it), and dismiss the keyboard on drag.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.body}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${pad} ${className ?? ''}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
