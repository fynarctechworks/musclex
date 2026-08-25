import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * RowCard — the table-row replacement.
 *
 * The web app renders dense tables via @tanstack/react-table, which has no
 * React Native equivalent (plan §6). Rather than simulate columns on a 6"
 * screen, a row becomes a card with a fixed information hierarchy:
 *
 *   avatar/leading · title + subtitle · trailing status · meta line
 *
 * Every list in the app (members, staff, invoices, classes, products) uses
 * this shape, so a member row and an invoice row are scannable the same way.
 * Columns that do not fit belong on the detail screen, not squeezed in here.
 */

export type RowCardProps = {
  title: string;
  subtitle?: string;
  /** Short status/amount shown at the trailing edge — usually a <Badge>. */
  trailing?: React.ReactNode;
  /** Secondary line under the main row: last visit, counts, etc. */
  meta?: string;
  /** Initials avatar. Pass `leading` instead for a custom node. */
  initials?: string;
  leading?: React.ReactNode;
  onPress?: () => void;
  /** Show a chevron. Defaults to true when the row is pressable. */
  chevron?: boolean;
  className?: string;
  testID?: string;
};

export function RowCard({
  title, subtitle, trailing, meta, initials, leading,
  onPress, chevron, className, testID,
}: RowCardProps) {
  const showChevron = chevron ?? Boolean(onPress);
  const Container = onPress ? Pressable : View;

  return (
    <Container
      testID={testID}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      // The whole row is the touch target — a 6" screen has no room for
      // precise tapping, and staff use this one-handed at a counter.
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3',
        onPress && 'active:opacity-70',
        className,
      )}>
      <View className="flex-row items-center gap-3">
        {leading ??
          (initials ? (
            <Avatar alt={title}>
              <AvatarFallback>
                <Text>{initials}</Text>
              </AvatarFallback>
            </Avatar>
          ) : null)}

        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-base font-medium text-foreground">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing}
        {showChevron ? <ChevronRight size={18} color="#888888" /> : null}
      </View>

      {meta ? (
        <Text numberOfLines={1} className="pt-2 text-sm text-muted-foreground">
          {meta}
        </Text>
      ) : null}
    </Container>
  );
}
