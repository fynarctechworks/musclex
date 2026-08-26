import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Icon, Loading, Row, Txt } from '../src/ui';
import { color, font, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useNearbyGyms } from '../src/api/queries';

/**
 * FIND A GYM — the public directory.
 *
 * This is a conversion surface, not a switcher: there is no endpoint to move a
 * session between gyms. A member who belongs to more than one picks at sign-in,
 * from the choices their phone number maps to. This screen exists so someone
 * with no gym (or looking for another) can see what is nearby.
 *
 * Distance sorting needs the device's location, which requires a permission
 * prompt this screen does not yet ask for, so results come back unranked.
 */
export default function GymsScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useNearbyGyms(query);

  const gyms = data?.gyms ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Find a gym" />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or city"
          placeholderTextColor={color.t4}
          accessibilityLabel="Search gyms"
          style={{
            height: 46,
            borderRadius: radius.md,
            backgroundColor: color.surface,
            borderWidth: 1,
            borderColor: color.line,
            color: color.t1,
            paddingHorizontal: space.lg,
            fontFamily: font,
            fontSize: 15,
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <Loading label="Looking for gyms" />
        ) : gyms.length === 0 ? (
          <Empty
            title={query ? 'No gyms match' : 'No gyms listed'}
            body={
              query
                ? 'Try a different name or city.'
                : 'Gyms appear here once they publish a public profile.'
            }
          />
        ) : (
          gyms.map((g, i) => (
            <Card key={g.tenantId ?? i}>
              <Row style={{ alignItems: 'flex-start', gap: space.md }}>
                <Icon name="location" size={20} tone="t3" decorative />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{g.gymName ?? g.branchName}</Txt>
                  <Txt variant="caption" tone="t3" style={{ marginTop: 2 }}>
                    {[g.branchName, g.address, g.city].filter(Boolean).join(' · ')}
                  </Txt>
                </View>
                {g.distanceKm != null ? (
                  <Txt variant="caption" tone="t3">{g.distanceKm.toFixed(1)} km</Txt>
                ) : null}
              </Row>
            </Card>
          ))
        )}

        <Txt variant="caption" tone="t4" style={{ textAlign: 'center', marginTop: space.md }}>
          Joining a gym happens at the gym. Once they add your number, sign in and it appears here.
        </Txt>
      </ScrollView>
    </View>
  );
}
