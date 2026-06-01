import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, MeshGradient, Screen, Txt } from '../../src/design-system';

const VALUE_PROPS = [
  { title: 'Walk in, tap once', body: 'Scan the gym QR and you’re checked in. No card, no queue.' },
  { title: 'Today’s plan, ready', body: 'Your trainer’s workout, logged with one thumb.' },
  { title: 'See yourself change', body: 'Weight, photos, streaks — your progress, beautifully.' },
];

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View className="h-[40%] justify-end overflow-hidden px-md pb-xl">
        <MeshGradient opacity={0.85} />
        <Txt variant="mono" className="mb-sm text-ink/80">{'FITSYNC // YOUR GYM, LIVE'}</Txt>
        <Txt variant="display-xl" weight="600" className="text-ink">
          Your gym, in your pocket.
        </Txt>
      </View>

      <View className="flex-1 justify-between px-md pt-xl pb-md">
        <View className="gap-lg">
          {VALUE_PROPS.map((v) => (
            <View key={v.title} className="flex-row gap-md">
              <View className="mt-[6px] h-[8px] w-[8px] rounded-full bg-cyan" />
              <View className="flex-1">
                <Txt variant="body-lg" weight="600" className="text-ink">
                  {v.title}
                </Txt>
                <Txt variant="body-sm" className="mt-xxs text-body">
                  {v.body}
                </Txt>
              </View>
            </View>
          ))}
        </View>

        <View className="gap-sm">
          <Button title="Get started" onPress={() => router.push('/phone')} fullWidth />
          <Txt variant="caption" className="text-center text-mute">
            Sign in with the phone number registered at your gym.
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
