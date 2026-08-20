import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { color, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { dayOf, timeOf } from '../src/lib/datetime';
import { useVisits, useVisitSummary } from '../src/api/queries';

/** Every check-in, newest first. The proof behind the streak. */
export default function VisitsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useVisits();
  const { data: summary } = useVisitSummary();

  if (isLoading) return <Loading label="Loading visits" />;
  const visits = data?.visits ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Visits" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.md }}>
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
            <Txt variant="small" tone="t2" style={{ marginTop: space.md }}>
              No check-ins recorded yet. Scan the QR at the door and this fills in.
            </Txt>
          ) : (
            visits.map((v) => (
              <Row key={v.id} style={{ marginTop: space.md, alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Txt variant="bodyStrong">{dayOf(v.checkedInAt)}</Txt>
                  <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
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
