import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Icon, Loading, Row, Txt } from '../src/ui';
import { Field } from '../src/ui/Field';
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
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Find a gym" />
      <View className="px-4 pb-3">
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or city"
          accessibilityLabel="Search gyms"
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-2 px-4 pb-32"
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
              <Row className="items-start gap-3">
                <Icon name="location" size={20} tone="t3" decorative />
                <View className="flex-1">
                  <Txt variant="bodyStrong">{g.gymName ?? g.branchName}</Txt>
                  <Txt variant="caption" tone="t3" className="mt-0.5">
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

        <Txt variant="caption" tone="t4" className="mt-3 text-center">
          Joining a gym happens at the gym. Once they add your number, sign in and it appears here.
        </Txt>
      </ScrollView>
    </View>
  );
}
