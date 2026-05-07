'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
  useInitMfaSetup,
  useConfirmMfaSetup,
  useDisableMfa,
} from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, ShieldCheck, ShieldOff, Shield, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
// ── Backup Codes Display ──────────────────────────────────────────────────────

function BackupCodesModal({
  codes,
  onClose,
}: {
  codes: string[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Your Recovery Codes</DialogTitle>
          <DialogDescription>
            Store these codes somewhere safe. Each code can only be used once to sign in if you lose
            your phone. They will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 my-2">
          {codes.map((code) => (
            <code
              key={code}
              className="rounded bg-muted px-3 py-1.5 text-center text-[13px] font-mono tracking-widest text-foreground border border-border"
            >
              {code}
            </code>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={copyAll}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy All'}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            I've Saved Them
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── MFA Setup Flow ────────────────────────────────────────────────────────────

function MfaSetupModal({ onClose }: { onClose: () => void }) {
  const initSetup = useInitMfaSetup();
  const confirmSetup = useConfirmMfaSetup();
  const [step, setStep] = useState<'init' | 'scan' | 'confirm'>('init');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackup, setShowBackup] = useState(false);

  const startSetup = () => {
    initSetup.mutate(undefined, {
      onSuccess: (data) => {
        setQrCode(data.qr_code);
        setSecret(data.manual_entry_key);
        setStep('scan');
      },
    });
  };

  const confirmCode = (e: React.FormEvent) => {
    e.preventDefault();
    confirmSetup.mutate(code, {
      onSuccess: (data) => {
        setBackupCodes(data.backup_codes);
        setShowBackup(true);
      },
    });
  };

  if (showBackup) {
    return (
      <BackupCodesModal
        codes={backupCodes}
        onClose={() => {
          toast.success('2FA enabled successfully');
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
        </DialogHeader>

        {step === 'init' && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Add an extra layer of security. You'll need Google Authenticator or any TOTP app.
            </p>
            {initSetup.isError && (
              <p className="text-[13px] text-destructive">
                {(initSetup.error as Error)?.message}
              </p>
            )}
            <Button className="w-full" onClick={startSetup} disabled={initSetup.isPending}>
              {initSetup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Started
            </Button>
          </div>
        )}

        {step === 'scan' && (
          <div className="space-y-4">
            <p className="text-[13px] text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code below.
            </p>
            {qrCode && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="2FA QR Code" width={180} height={180} />
              </div>
            )}
            <details className="text-[12px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">Can't scan? Enter manually</summary>
              <code className="block mt-1 font-mono bg-muted rounded px-2 py-1 break-all select-all">{secret}</code>
            </details>
            <form onSubmit={confirmCode} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Verification Code</Label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center tracking-widest font-mono text-lg"
                  autoFocus
                  required
                />
              </div>
              {confirmSetup.isError && (
                <p className="text-[13px] text-destructive">
                  {(confirmSetup.error as Error)?.message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={confirmSetup.isPending}>
                {confirmSetup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Enable
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Disable MFA ───────────────────────────────────────────────────────────────

function DisableMfaModal({ onClose }: { onClose: () => void }) {
  const disableMfa = useDisableMfa();
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    disableMfa.mutate(password, {
      onSuccess: () => {
        toast.success('2FA disabled');
        onClose();
      },
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogDescription>
            Enter your password to confirm. Your account will be less secure without 2FA.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Password</Label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {disableMfa.isError && (
            <p className="text-[13px] text-destructive">
              {(disableMfa.error as Error)?.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={disableMfa.isPending}>
              {disableMfa.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable 2FA
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Profile Page ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const admin = useAuthStore((s) => s.admin);
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [name, setName] = useState(admin?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showDisableMfa, setShowDisableMfa] = useState(false);

  const mfaEnabled = profile?.mfa_enabled ?? admin?.mfa_enabled ?? false;

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(name, {
      onSuccess: () => toast.success('Profile updated'),
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    setPwError('');
    changePassword.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed — please sign in again');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-[18px] font-semibold text-foreground">Profile & Security</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage your account settings</p>
      </div>

      {/* Display Info */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-[14px] font-medium text-foreground">Account Info</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Email</Label>
            <Input value={profile?.email ?? admin?.email ?? ''} disabled className="opacity-60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Display Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <Button type="submit" disabled={updateProfile.isPending} size="sm">
            {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </div>

      {/* Change Password */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-[14px] font-medium text-foreground">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Current Password</Label>
            <Input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">New Password</Label>
            <Input
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Confirm New Password</Label>
            <Input
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {pwError && <p className="text-[13px] text-destructive">{pwError}</p>}
          {changePassword.isError && (
            <p className="text-[13px] text-destructive">
              {(changePassword.error as Error)?.message}
            </p>
          )}
          <Button type="submit" disabled={changePassword.isPending} size="sm">
            {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </div>

      {/* 2FA */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-foreground flex items-center gap-2">
              {mfaEnabled ? (
                <ShieldCheck className="h-4 w-4 text-success" />
              ) : (
                <Shield className="h-4 w-4 text-muted-foreground" />
              )}
              Two-Factor Authentication
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {mfaEnabled
                ? `Enabled via Google Authenticator · ${profile?.backup_codes_remaining ?? 0} recovery code(s) remaining`
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
          {mfaEnabled ? (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowDisableMfa(true)}
            >
              <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
              Disable
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowMfaSetup(true)}>
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Enable
            </Button>
          )}
        </div>
      </div>

      {showMfaSetup && <MfaSetupModal onClose={() => setShowMfaSetup(false)} />}
      {showDisableMfa && <DisableMfaModal onClose={() => setShowDisableMfa(false)} />}
    </div>
  );
}
