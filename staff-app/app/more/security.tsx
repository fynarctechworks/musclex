import React from 'react';
import { Image, ScrollView, Share, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, ShieldOff, Share2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/ui/Loading';
import { ErrorState } from '@/ui/States';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { tokens } from '@/ui/tokens';
import {
  twoFactorDisable,
  twoFactorSetup,
  twoFactorStatus,
  twoFactorVerifySetup,
  type TwoFactorSetup,
} from '@/api/auth';

/**
 * ────────────────────────────────────────────────────────────────
 * SECURITY — two-factor authentication for THIS account
 * ────────────────────────────────────────────────────────────────
 *
 * The web app has had this page since 2FA shipped; the phone had the login
 * step-2 screen but no way to turn 2FA ON, so a staff member could be
 * challenged by a control they could never enable themselves.
 *
 * Scoped to the signed-in person on purpose. Resetting SOMEONE ELSE's 2FA
 * (`/auth/2fa/admin-reset/:userId`) is an owner action taken when a colleague
 * has lost their phone — a support conversation, not a two-tap flow on the
 * device of whoever happens to be holding the gym's iPad.
 */
export default function Security() {
  const qc = useQueryClient();
  const toast = useToast();

  const status = useQuery({
    queryKey: ['auth', '2fa', 'status'],
    queryFn: twoFactorStatus,
  });

  const [enrolling, setEnrolling] = React.useState(false);
  const [disabling, setDisabling] = React.useState(false);

  const refreshStatus = () => qc.invalidateQueries({ queryKey: ['auth', '2fa', 'status'] });

  if (status.isLoading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Stack.Screen options={{ headerShown: true, title: 'Security' }} />
        <Loading />
      </SafeAreaView>
    );
  }

  if (status.isError) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
        <Stack.Screen options={{ headerShown: true, title: 'Security' }} />
        <ErrorState
          title="Could not load security settings"
          body="Your account is unchanged."
          onRetry={() => status.refetch()}
        />
      </SafeAreaView>
    );
  }

  const enabled = status.data?.enabled === true;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <Stack.Screen options={{ headerShown: true, title: 'Security' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <View className="gap-3 rounded-lg border border-border bg-card p-4">
          <View className="flex-row items-center gap-3">
            {enabled ? (
              <ShieldCheck size={22} color={tokens.foreground} />
            ) : (
              <ShieldOff size={22} color={tokens.mutedForeground} />
            )}
            <View className="min-w-0 flex-1">
              <Text className="text-base font-medium text-foreground">
                Two-factor authentication
              </Text>
              <Text className="text-sm text-muted-foreground">
                {enabled
                  ? 'Sign-in asks for a code from your authenticator app.'
                  : 'Sign-in needs only your password.'}
              </Text>
            </View>
            <Badge variant={enabled ? 'default' : 'secondary'}>
              <Text>{enabled ? 'On' : 'Off'}</Text>
            </Badge>
          </View>

          {enabled ? (
            <Button variant="outline" onPress={() => setDisabling(true)} testID="disable-2fa">
              <Text>Turn off</Text>
            </Button>
          ) : (
            <Button onPress={() => setEnrolling(true)} testID="enable-2fa">
              <Text>Turn on</Text>
            </Button>
          )}
        </View>

        <Text className="px-1 text-sm text-muted-foreground">
          A gym phone is shared and frequently lost. With two-factor on, a
          stolen password is not enough to reach members&apos; details on its own.
        </Text>
      </ScrollView>

      <EnrolSheet
        open={enrolling}
        onClose={() => setEnrolling(false)}
        onEnabled={() => {
          void refreshStatus();
          toast.show('Two-factor authentication is on', 'success');
        }}
      />
      <DisableSheet
        open={disabling}
        onClose={() => setDisabling(false)}
        onDisabled={() => {
          void refreshStatus();
          toast.show('Two-factor authentication is off', 'info');
        }}
      />
    </SafeAreaView>
  );
}

/* ── Enrolment ───────────────────────────────────────────────────────────── */

/**
 * Three steps in one sheet: scan, confirm, then save the backup codes.
 *
 * The backup codes step is NOT skippable-by-accident. They are shown once and
 * the server keeps only hashes, so a person who closes this without saving
 * them has no way back in if they lose the phone — which on a shared gym
 * handset is a realistic Tuesday, not a rare disaster.
 */
function EnrolSheet({
  open,
  onClose,
  onEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onEnabled: () => void;
}) {
  const toast = useToast();
  const [setup, setSetup] = React.useState<TwoFactorSetup | null>(null);
  const [code, setCode] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);

  const begin = useMutation({
    mutationFn: twoFactorSetup,
    onSuccess: setSetup,
    onError: (e: Error) => toast.show(e.message || 'Could not start setup', 'error'),
  });

  const confirm = useMutation({
    mutationFn: () => twoFactorVerifySetup(code.trim()),
    onSuccess: (res) => {
      setBackupCodes(res.backup_codes ?? []);
      onEnabled();
    },
    onError: (e: Error) => toast.show(e.message || 'That code was not accepted', 'error'),
  });

  // Fetch the secret only when the sheet actually opens. Calling /setup rotates
  // the pending secret server-side, so doing it on mount would invalidate a QR
  // the person may already be looking at.
  React.useEffect(() => {
    if (open && !setup && !begin.isPending) begin.mutate();
    if (!open) {
      setSetup(null);
      setCode('');
      setBackupCodes(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const done = backupCodes !== null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={done ? 'Save your backup codes' : 'Turn on two-factor'}
      snapPoints={['85%']}
    >
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {done ? (
          <BackupCodes codes={backupCodes!} onDone={onClose} />
        ) : begin.isPending || !setup ? (
          <Loading />
        ) : (
          <>
            <Text className="text-sm text-muted-foreground">
              Scan this with Google Authenticator, 1Password, Authy or any TOTP
              app, then enter the 6-digit code it shows.
            </Text>

            {/* The QR arrives as a base64 data URI, so it renders without a
                network fetch and without a QR library. */}
            <View className="items-center rounded-lg bg-white p-4">
              <Image
                source={{ uri: setup.qr_code }}
                style={{ width: 200, height: 200 }}
                accessibilityLabel="Two-factor QR code"
              />
            </View>

            <View className="gap-1">
              <Label><Text>Can&apos;t scan? Enter this key by hand</Text></Label>
              {/* Selectable, so long-press → Copy works with no dependency. */}
              <View className="rounded-md border border-border bg-card px-3 py-2">
                <Text selectable className="font-mono text-sm text-foreground">
                  {setup.manual_key}
                </Text>
              </View>
            </View>

            <View className="gap-1">
              <Label><Text>6-digit code</Text></Label>
              <Input
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                testID="totp-code"
              />
            </View>

            <Button
              onPress={() => confirm.mutate()}
              disabled={code.trim().length !== 6 || confirm.isPending}
              testID="confirm-2fa"
            >
              <Text>{confirm.isPending ? 'Checking…' : 'Confirm'}</Text>
            </Button>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const toast = useToast();

  return (
    <View className="gap-4">
      <Text className="text-sm text-muted-foreground">
        Each code works once, if you lose your phone. This is the only time
        they are shown — the server keeps only hashes and cannot show them
        again.
      </Text>

      <View className="rounded-lg border border-border bg-card p-4">
        {codes.map((c) => (
          <Text key={c} selectable className="py-0.5 font-mono text-base text-foreground">
            {c}
          </Text>
        ))}
      </View>

      {/*
        RN's built-in Share sheet rather than a clipboard dependency: it offers
        Copy alongside Notes, Files and a password manager, which is where
        these actually belong. The codes are also selectable above, so
        long-press → Copy works without leaving the screen.
      */}
      <Button
        variant="outline"
        onPress={async () => {
          try {
            const res = await Share.share({ message: codes.join('\n') });
            if (res.action === Share.sharedAction) setAcknowledged(true);
          } catch {
            // A dismissed share sheet is not an error, and must not block the
            // person who wrote the codes down on paper instead.
          }
        }}
        testID="save-backup-codes"
      >
        <Share2 size={16} color={tokens.foreground} />
        <Text>Save codes</Text>
      </Button>

      <Button
        variant="ghost"
        onPress={() => setAcknowledged(true)}
        testID="wrote-down-backup-codes"
      >
        <Text>I wrote them down instead</Text>
      </Button>

      {/* Deliberately gated on having copied them. The alternative — a Done
          button available immediately — makes losing them the default. */}
      <Button onPress={onDone} disabled={!acknowledged} testID="finish-2fa">
        <Check size={16} color={tokens.background} />
        <Text>I&apos;ve saved them</Text>
      </Button>
    </View>
  );
}

/* ── Disable ─────────────────────────────────────────────────────────────── */

function DisableSheet({
  open,
  onClose,
  onDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onDisabled: () => void;
}) {
  const toast = useToast();
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  const disable = useMutation({
    mutationFn: () => twoFactorDisable(password),
    onSuccess: () => {
      onDisabled();
      onClose();
    },
    onError: (e: Error) => toast.show(e.message || 'Could not turn off two-factor', 'error'),
  });

  return (
    <Sheet open={open} onClose={onClose} title="Turn off two-factor" snapPoints={['45%']}>
      <View style={{ padding: 16, gap: 16 }}>
        <Text className="text-sm text-muted-foreground">
          Enter your account password. A code is deliberately NOT accepted here:
          whoever is holding an unlocked phone already has the authenticator on
          it, so a code would let them switch off the thing protecting the
          account.
        </Text>
        <View className="gap-1">
          <Label><Text>Password</Text></Label>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            testID="disable-password"
          />
        </View>
        <Button
          variant="destructive"
          onPress={() => disable.mutate()}
          disabled={password.length === 0 || disable.isPending}
          testID="confirm-disable-2fa"
        >
          <Text>{disable.isPending ? 'Turning off…' : 'Turn off'}</Text>
        </Button>
      </View>
    </Sheet>
  );
}
