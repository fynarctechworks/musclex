import React from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ScanGate, looksLikeMemberCode } from '@/lib/scan';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * QR SCANNER — the fast path through the door
 * ────────────────────────────────────────────────────────────────
 *
 * expo-camera is imported LAZILY, matching member-app: the native view is not
 * constructed, and the permission prompt is not triggered, unless somebody
 * actually opens the scanner. A front-desk staffer who only ever searches by
 * name is never asked for camera access.
 *
 * Scanning auto-submits — there is no confirm step, unlike manual check-in.
 * That asymmetry is deliberate. Manual check-in confirms because the staffer
 * picked a row from a list of similar names and could have picked wrong. A
 * scan carries an HMAC-signed member id: there is no ambiguity to resolve, and
 * a confirm tap on every scan would make the queue slower than typing.
 */

export type ScanOutcome = { ok: true; message: string } | { ok: false; message: string };

interface Props {
  /**
   * Submit a scanned code. Resolve with the outcome to show; the scanner stays
   * open for the next member either way, because a queue does not stop for one
   * failure.
   *
   * `retryable` tells the gate whether a re-scan of this same code could
   * plausibly succeed (network blip) or never will (revoked card).
   */
  onScan: (code: string) => Promise<ScanOutcome & { retryable?: boolean }>;
  /**
   * The way out of the scanner, if there is one.
   *
   * OPTIONAL because a kiosk has none. Passing a no-op here instead would
   * render a button that visibly does nothing — and on an unattended lobby
   * tablet, "Search by name" is a staff action being offered to a member.
   */
  onClose?: () => void;
  /** Label for that escape hatch. Defaults to the staff wording. */
  closeLabel?: string;
}

type Perm = 'checking' | 'granted' | 'denied' | 'unsupported';

export function QrScanner({ onScan, onClose, closeLabel = 'Search by name' }: Props) {
  const [perm, setPerm] = React.useState<Perm>('checking');
  const [CameraView, setCameraView] = React.useState<React.ComponentType<any> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [last, setLast] = React.useState<ScanOutcome | null>(null);

  const gate = React.useRef(new ScanGate()).current;
  /*
   * The camera keeps firing after unmount if a request is still in flight, and
   * setting state then warns and leaks. Tracked explicitly rather than relying
   * on the scan handler being torn down in time.
   */
  const alive = React.useRef(true);

  React.useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (Platform.OS === 'web') { setPerm('unsupported'); return; }
      try {
        const mod = await import('expo-camera');
        const res = await mod.Camera.requestCameraPermissionsAsync();
        if (cancelled) return;
        setCameraView(() => mod.CameraView);
        setPerm(res.granted ? 'granted' : 'denied');
      } catch {
        if (!cancelled) setPerm('unsupported');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handle = React.useCallback(
    async ({ data }: { data: string }) => {
      const code = (data ?? '').trim();

      // Not one of ours — say so without a round trip, and without burning the
      // gate, so the member's real card can be scanned straight after.
      if (!looksLikeMemberCode(code)) {
        if (alive.current) setLast({ ok: false, message: 'Not a MuscleX code' });
        return;
      }

      if (!gate.claim(code)) return;
      if (alive.current) setBusy(true);

      try {
        const outcome = await onScan(code);
        if (outcome.retryable) gate.forget(code);
        if (alive.current) setLast({ ok: outcome.ok, message: outcome.message });
      } catch (e) {
        gate.forget(code); // unexpected throw — let them try again
        if (alive.current) {
          setLast({ ok: false, message: e instanceof Error ? e.message : 'Scan failed' });
        }
      } finally {
        gate.release();
        if (alive.current) setBusy(false);
      }
    },
    [gate, onScan],
  );

  if (perm !== 'granted' || !CameraView) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-8" testID="qr-scanner-fallback">
        {perm === 'checking' ? (
          <>
            <ActivityIndicator />
            <Text className="text-muted-foreground">Starting camera…</Text>
          </>
        ) : (
          <>
            <Text className="text-center text-lg font-semibold text-foreground">
              {perm === 'unsupported' ? 'Scanning needs the app' : 'Camera access is off'}
            </Text>
            <Text className="text-center text-muted-foreground">
              {perm === 'unsupported'
                ? 'QR check-in works on the phone app.'
                : onClose
                  ? 'Allow camera access to scan member codes. You can still search by name.'
                  : 'Allow camera access to scan member codes. Please see the front desk.'}
            </Text>
            {perm === 'denied' ? (
              <Button variant="outline" onPress={() => void Linking.openSettings()}>
                <Text>Open Settings</Text>
              </Button>
            ) : null}
            {onClose ? (
              <Button onPress={onClose}><Text>Search instead</Text></Button>
            ) : null}
          </>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1" testID="qr-scanner">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        // Only QR. Leaving other symbologies on means a staffer pointing the
        // phone at a protein tub gets a barcode event we then have to reject.
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handle}
      />

      {/* Aiming frame. Purely a target for the member to fill. */}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View
          className="h-56 w-56 rounded-3xl border-2"
          style={{ borderColor: 'rgba(255,255,255,0.9)' }}
        />
      </View>

      <View className="absolute inset-x-0 bottom-0 gap-3 p-5" pointerEvents="box-none">
        {last ? (
          <View
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: last.ok ? tokens.success : tokens.destructive }}
            testID="qr-result"
          >
            <Text className="text-center font-semibold" style={{ color: '#fff' }}>
              {last.message}
            </Text>
          </View>
        ) : (
          <View className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Text className="text-center" style={{ color: '#fff' }}>
              {busy ? 'Checking in…' : 'Point at the member’s QR code'}
            </Text>
          </View>
        )}
        {onClose ? (
          <Button variant="secondary" onPress={onClose} testID="qr-close">
            <Text>{closeLabel}</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
