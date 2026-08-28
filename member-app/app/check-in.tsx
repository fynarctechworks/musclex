import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Icon } from '../src/ui/Icon';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useCheckIn, useDigitalId, useLocations } from '../src/api/queries';

/**
 * ────────────────────────────────────────────────────────────────
 * CHECK IN — getting through the door
 * ────────────────────────────────────────────────────────────────
 *
 * Used standing at a front desk with a queue behind you, so this screen holds
 * ONE thing and puts it at the top: the code the desk scans, and the button for
 * when the desk would rather you tapped it yourself.
 *
 * It used to live at the top of the Gym tab, underneath the occupancy meter and
 * above six social cards. When that tab was retired the check-in card went with
 * it: the screen stayed mounted but nothing routed to it, so the only "Check
 * in" link in the app (on Train) pointed at `/scan` — the friend-code scanner,
 * which sends you to somebody's profile. This screen is that card given a
 * route of its own, so the entry point cannot go missing again when the
 * surface around it is rearranged. That dead tab has since been deleted.
 *
 * Nothing about the mechanism is new: the same rotating `dynamicQr` and the
 * same idempotent `useCheckIn()` write, which queues to the outbox when the
 * gym's wifi is not cooperating.
 */
export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const { data: id, isLoading } = useDigitalId();
  const { data: locations } = useLocations();
  const checkIn = useCheckIn();

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (isLoading && !id) return <Loading label="Loading your code" />;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Check in" />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-32">
        {error ? (
          <Notice title="Could not check you in" body={error} onDismiss={() => setError(null)} />
        ) : null}

        {/*
          Confirmation as a real state rather than a toast that disappears
          before someone standing at a desk has looked up from the phone.

          `queued` is a success, not a failure — the write is on disk under an
          idempotency key and will sync. Saying "check in failed" here would
          send members back to the queue for something that already worked.
        */}
        {done ? (
          <Card tone="good">
            <Row className="justify-start gap-2">
              <Icon name="check" size={18} tone="good" decorative />
              <Txt variant="bodyStrong" tone="good">
                You are checked in
              </Txt>
            </Row>
          </Card>
        ) : null}

        <Card>
          <Label>Your code</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            Show this at the front desk. The code rotates every 35 seconds, so a screenshot will
            not work.
          </Txt>

          {id?.dynamicQr ? (
            <View className="border-border bg-card mt-4 items-center rounded-xl border p-3.5">
              <Image
                source={{ uri: id.dynamicQr }}
                style={{ width: 176, height: 176 }}
                accessibilityLabel="Your check-in QR code"
              />
            </View>
          ) : (
            <Empty title="QR unavailable" body="Your gym has not issued a code for this account." />
          )}

          {/* The spoken fallback for a scanner that will not read the screen —
              a member can read this out and the desk can key it in. */}
          <View className="mt-4">
            <Txt variant="caption" tone="t3">
              Member code
            </Txt>
            <Txt variant="bodyStrong" className="mt-0.5">
              {id?.memberCode ?? '--'}
            </Txt>
          </View>

          <View className="mt-5">
            <Button
              title={done ? 'Checked in' : 'Check in now'}
              disabled={done}
              loading={checkIn.isPending}
              onPress={() => {
                setError(null);
                checkIn.mutate(undefined, {
                  onSuccess: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                      () => {},
                    );
                    setDone(true);
                  },
                  onError: (e) =>
                    setError(e instanceof Error ? e.message : 'Please try again, or ask the desk.'),
                });
              }}
            />
          </View>
        </Card>

        {/*
          Which branches this code opens.

          Moved here from the retired Gym tab, which was the only place it
          existed. It belongs with the code rather than in a settings list:
          somebody holding up a QR is exactly the person wondering whether this
          branch is one of theirs.
        */}
        {(locations?.branches ?? []).length ? (
          <Card>
            <Label>Where this works</Label>
            {(locations?.branches ?? []).map((br) => (
              <View key={br.id} className="mt-3">
                <Txt variant="bodyStrong">{br.name}</Txt>
                <Txt variant="caption" tone="t3" className="mt-0.5">
                  {[br.address, br.city].filter(Boolean).join(', ')}
                </Txt>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
