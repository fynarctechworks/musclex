import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { dayOf, timeOf } from '../src/lib/datetime';
import { useVisits, useVisitSummary } from '../src/api/queries';

/** Every check-in, newest first. The proof behind the streak. */
export default function VisitsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useVisits();
  const { data: summary } = useVisitSummary();

  if (isLoading) return <Loading label="Loading visits" />;
  const visits = data?.visits ?? [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Visits" />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#79716b" />
        }
        contentContainerClassName="gap-3 px-4 pb-32">
        <Card>
          <Row style={{ alignItems: 'flex-end' }}>
            <View>
              <Txt variant="display">{summary?.thisMonthVisits ?? 0}</Txt>
              <Txt variant="caption" tone="t3">this month</Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt variant="display">{summary?.totalVisits ?? 0}</Txt>
              <Txt variant="caption" tone="t3">all time</Txt>
            </View>
          </Row>
        </Card>

        <Card>
          <Label>History</Label>
          {visits.length === 0 ? (
            <Txt variant="small" tone="t2" className="mt-3">
              No check-ins recorded yet. Scan the QR at the door and this fills in.
            </Txt>
          ) : (
            visits.map((v) => (
              <Row key={v.id} className="mt-3 items-start">
                <View className="flex-1 pr-3">
                  <Txt variant="bodyStrong">{dayOf(v.checkedInAt)}</Txt>
                  <Txt variant="caption" tone="t3" className="mt-0.5">
                    {v.branchName ?? 'Your gym'}
                    {v.method ? ` · ${v.method}` : ''}
                  </Txt>
                </View>
                <Txt variant="small" tone="t2">{timeOf(v.checkedInAt)}</Txt>
              </Row>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
