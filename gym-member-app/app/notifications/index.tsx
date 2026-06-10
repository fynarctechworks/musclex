import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SkeletonCard,
  Txt,
  useThemeColors,
  type ThemeColors,
} from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';
import { useHome, useChatThreads } from '../../src/api/queries';
import { relativeFromNow } from '../../src/lib/format';
import {
  buildNotifications,
  useNotificationReads,
  type AppNotification,
  type NotificationTone,
} from '../../src/features/notifications/inbox';

/**
 * Notification inbox — the feed the bell opens. Items are derived from real
 * already-loaded data (Home dashboard + trainer-chat unread), each deep-linking
 * to where the member can act. Tapping a row opens a bottom sheet with the full
 * detail + a primary action, mirroring the reference. The gear (header overflow)
 * opens notification settings. Read-state is tracked on-device.
 */
function toneColor(theme: ThemeColors, tone: NotificationTone): string {
  switch (tone) {
    case 'success':
      return theme.success;
    case 'warning':
      return theme.warning;
    case 'danger':
      return theme.error;
    case 'brand':
      return theme.accent;
    default:
      return theme.body;
  }
}

export default function NotificationsInboxScreen() {
  const router = useRouter();
  const theme = useThemeColors();

  const home = useHome();
  const chat = useChatThreads();

  const readIds = useNotificationReads((s) => s.readIds);
  const markRead = useNotificationReads((s) => s.markRead);
  const hydrateReads = useNotificationReads((s) => s.hydrate);

  const [active, setActive] = useState<AppNotification | null>(null);

  useEffect(() => {
    void hydrateReads();
  }, [hydrateReads]);

  const notifications = useMemo(
    () => buildNotifications(home.data, chat.data),
    [home.data, chat.data],
  );

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unread = notifications.filter((n) => !readSet.has(n.id));
  const read = notifications.filter((n) => readSet.has(n.id));

  const isLoading = home.isLoading || chat.isLoading;
  const isError = home.isError && chat.isError && !home.data && !chat.data;
  const refreshing = home.isRefetching || chat.isRefetching;
  const onRefresh = () => {
    home.refetch();
    chat.refetch();
  };

  function openDetail(n: AppNotification) {
    setActive(n);
    void markRead([n.id]);
  }

  function onAct() {
    const route = active?.cta?.route;
    setActive(null);
    if (route) router.push(route as never);
  }

  return (
    <Screen scroll padded={false} onRefresh={onRefresh} refreshing={refreshing}>
      <View className="px-md pb-sm pt-md">
        <ScreenHeader
          title="Notifications"
          className="mb-0"
          onMore={() => router.push('/notifications/settings')}
        />
      </View>

      <View className="gap-sm px-md">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : isError ? (
          <Card>
            <ErrorState compact onRetry={onRefresh} retrying={refreshing} />
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <EmptyState
              icon="bell"
              title="You're all caught up"
              message="Reminders about your classes, streak, trainer messages and membership will show up here."
              actionLabel="Notification settings"
              onAction={() => router.push('/notifications/settings')}
            />
          </Card>
        ) : (
          <>
            {unread.length > 0 && read.length > 0 ? (
              <SectionLabel text="NEW" theme={theme} />
            ) : null}
            {unread.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                unread
                theme={theme}
                onPress={() => openDetail(n)}
              />
            ))}

            {unread.length > 0 && read.length > 0 ? (
              <SectionLabel text="EARLIER" theme={theme} className="mt-md" />
            ) : null}
            {read.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                unread={false}
                theme={theme}
                onPress={() => openDetail(n)}
              />
            ))}
          </>
        )}
        <View className="h-2xl" />
      </View>

      {/* Detail sheet — full info + primary action, matching the reference. */}
      <BottomSheet visible={!!active} onClose={() => setActive(null)} title={active?.title}>
        {active ? (
          <View>
            <View className="mb-md flex-row items-center gap-md">
              <IconCircle icon={active.icon} color={toneColor(theme, active.tone)} size={48} />
              {active.at ? (
                <Txt variant="body-sm" className="text-mute">
                  {relativeFromNow(active.at)}
                </Txt>
              ) : null}
            </View>
            <Txt variant="body-md" className="text-body" style={{ lineHeight: 22 }}>
              {active.body}
            </Txt>
            {active.cta ? (
              <View className="mt-lg">
                <Button title={active.cta.label} fullWidth onPress={onAct} />
              </View>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

function SectionLabel({
  text,
  theme,
  className = '',
}: {
  text: string;
  theme: ThemeColors;
  className?: string;
}) {
  return (
    <Txt variant="caption" weight="600" className={`px-xs text-mute ${className}`} style={{ color: theme.mute }}>
      {text}
    </Txt>
  );
}

function IconCircle({
  icon,
  color,
  size = 44,
}: {
  icon: AppNotification['icon'];
  color: string;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-full border border-hairline bg-surface"
      style={{ width: size, height: size }}
    >
      <Icon name={icon} color={color} size={size * 0.46} />
    </View>
  );
}

function NotificationRow({
  n,
  unread,
  theme,
  onPress,
}: {
  n: AppNotification;
  unread: boolean;
  theme: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-start gap-md">
        <IconCircle icon={n.icon} color={toneColor(theme, n.tone)} />

        <View className="flex-1">
          <View className="flex-row items-start">
            <Txt
              variant="body-md"
              weight="600"
              className="flex-1 pr-sm text-ink"
              numberOfLines={2}
            >
              {n.title}
            </Txt>
            {unread ? (
              <View
                className="mt-xxs rounded-full"
                style={{ width: 9, height: 9, backgroundColor: theme.primary }}
              />
            ) : null}
          </View>

          <Txt variant="body-sm" className="mt-xxs text-body" numberOfLines={2}>
            {n.body}
          </Txt>

          <View className="mt-xs flex-row items-center justify-between">
            <Txt variant="caption" className="text-mute">
              {n.at ? relativeFromNow(n.at) : n.cta ? 'Tap for details' : ''}
            </Txt>
            <Icon name="chevron-right" color={theme.mute} size={16} />
          </View>
        </View>
      </View>
    </Card>
  );
}
