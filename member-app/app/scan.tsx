import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Label, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { Field } from '../src/ui/Field';
import { parseMemberCode, requestCameraPermission, scanningSupported } from '../src/lib/qr';

/**
 * SCAN — point the camera at somebody's code.
 *
 * The camera view is loaded lazily and only after permission is granted, so
 * nothing native is touched on a screen that might just be showing the paste
 * box. Web and anything without a camera fall back to pasting a code, which is
 * not a degraded experience so much as the same thing typed.
 */
export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [granted, setGranted] = useState<boolean | null>(null);
  const [CameraView, setCameraView] = useState<any>(null);
  const [pasted, setPasted] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);
  /** Guards against a barcode firing dozens of times a second. */
  const [handled, setHandled] = useState(false);

  function go(raw: string) {
    const id = parseMemberCode(raw);
    if (!id) {
      setNotice({
        tone: 'error',
        title: 'That is not a MuscleX code',
        body: 'Ask them to open Find people and show you their code.',
      });
      return;
    }
    setHandled(true);
    router.replace(`/person/${id}`);
  }

  async function openCamera() {
    const ok = await requestCameraPermission();
    setGranted(ok);
    if (!ok) {
      setNotice({
        tone: 'error',
        title: 'Camera not allowed',
        body: 'You can paste their code below instead.',
      });
      return;
    }
    const mod = await import('expo-camera');
    setCameraView(() => mod.CameraView);
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Scan a code" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        {scanningSupported() ? (
          <Card>
            <Label>Camera</Label>
            {CameraView && granted ? (
              // A near-black ground so the preview does not flash white while
              // the camera warms up.
              <View className="bg-foreground mt-3 h-[300px] overflow-hidden rounded-lg">
                <CameraView
                  className="flex-1"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={
                    handled ? undefined : ({ data }: { data: string }) => go(data)
                  }
                />
              </View>
            ) : (
              <View className="mt-3">
                <Button title="Open the camera" variant="secondary" onPress={openCamera} />
              </View>
            )}
          </Card>
        ) : null}

        <Card>
          <Label>Or paste their code</Label>
          <Row className="mt-3 gap-2">
            <Field
              value={pasted}
              onChangeText={setPasted}
              placeholder="musclex://u/…"
              accessibilityLabel="Paste a member code"
              autoCapitalize="none" />
            <Button title="Go" size="sm" disabled={!pasted.trim()} onPress={() => go(pasted)} />
          </Row>
          {!scanningSupported() ? (
            <Txt variant="caption" tone="t3" className="mt-2">
              Scanning needs a camera — on this device, paste the code instead.
            </Txt>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
}
