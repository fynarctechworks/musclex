'use client';

import { useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, Copy, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { VerifyCodeInput } from '@/components/shared/verify-code-input';
import { BackupCodesModal } from '@/components/shared/backup-codes-modal';
import { twoFactorApi, type TwoFactorSetupResponse } from '@/features/auth/two-factor-api';

type Step = 'idle' | 'qr' | 'verify' | 'done';

interface TwoFactorSetupCardProps {
  enabled: boolean;
  onStatusChange: () => void;
}

export function TwoFactorSetupCard({ enabled, onStatusChange }: TwoFactorSetupCardProps) {
  const [step, setStep] = useState<Step>('idle');
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);

  // — Disable state —
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const handleStartSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await twoFactorApi.setup();
      setSetup(data);
      setStep('qr');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start 2FA setup';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await twoFactorApi.verifySetup(code);
      setBackupCodes(data.backup_codes);
      setStep('done');
      setShowBackupModal(true);
      onStatusChange();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword) return;
    setDisabling(true);
    setError('');
    try {
      await twoFactorApi.disable(disablePassword);
      setShowDisable(false);
      setDisablePassword('');
      setStep('idle');
      onStatusChange();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(msg);
    } finally {
      setDisabling(false);
    }
  };

  const copyManualKey = async () => {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.manual_key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  // ── Enabled state ──
  if (enabled && step !== 'done') {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-semibold">Two-Factor Authentication</h3>
            <p className="text-sm text-primary">Enabled</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Your account is protected with an authenticator app. You&apos;ll be asked for a
          verification code each time you sign in.
        </p>

        {!showDisable ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDisable(true)}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <ShieldOff className="h-4 w-4 mr-1.5" />
            Disable 2FA
          </Button>
        ) : (
          <div className="space-y-3 bg-secondary p-4 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Enter your password to confirm disabling 2FA:
            </p>
            <Input
              type="password"
              placeholder="Password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowDisable(false);
                  setDisablePassword('');
                  setError('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisable}
                disabled={disabling || !disablePassword}
              >
                {disabling && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Confirm Disable
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Setup flow ──
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-foreground font-semibold">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            {step === 'idle' && 'Not enabled'}
            {step === 'qr' && 'Scan QR code'}
            {step === 'verify' && 'Enter verification code'}
            {step === 'done' && 'Setup complete!'}
          </p>
        </div>
      </div>

      {step === 'idle' && (
        <>
          <p className="text-muted-foreground text-sm mb-4">
            Add an extra layer of security to your account. You&apos;ll need an authenticator
            app like Google Authenticator, Authy, or 1Password.
          </p>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <Button
            onClick={handleStartSetup}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Enable 2FA
          </Button>
        </>
      )}

      {step === 'qr' && setup && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Scan this QR code with your authenticator app:
          </p>

          <div className="flex justify-center">
            <div className="bg-canvas p-3 rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qr_code}
                alt="2FA QR Code"
                width={200}
                height={200}
              />
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowManualKey(!showManualKey)}
              className="text-sm text-primary hover:text-primary/80 underline"
            >
              {showManualKey ? (
                <><EyeOff className="inline h-3.5 w-3.5 mr-1" />Hide manual key</>
              ) : (
                <><Eye className="inline h-3.5 w-3.5 mr-1" />Can&apos;t scan? Enter key manually</>
              )}
            </button>
          </div>

          {showManualKey && (
            <div className="flex items-center gap-2 bg-secondary p-3 rounded-lg border border-border">
              <code className="flex-1 text-sm font-mono text-foreground break-all">
                {setup.manual_key}
              </code>
              <button onClick={copyManualKey} className="text-primary hover:text-primary/80">
                {keyCopied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          <Button
            onClick={() => setStep('verify')}
            className="w-full"
          >
            I&apos;ve scanned the code
          </Button>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Enter the 6-digit code from your authenticator app:
          </p>
          <VerifyCodeInput
            onComplete={handleVerifyCode}
            disabled={loading}
            error={!!error}
          />
          {loading && (
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStep('qr');
              setError('');
            }}
          >
            Back
          </Button>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-medium">2FA is now enabled!</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Make sure you&apos;ve saved your backup codes in a safe place.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBackupModal(true)}
          >
            View Backup Codes
          </Button>
        </div>
      )}

      <BackupCodesModal
        open={showBackupModal}
        codes={backupCodes}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
}
