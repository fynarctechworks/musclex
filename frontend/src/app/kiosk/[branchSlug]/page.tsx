'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LogIn, LogOut, Lock, QrCode as QrIcon, ScanFace, ScrollText, Wifi, WifiOff } from 'lucide-react';
import { branchesApi } from '@/features/branches';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCheckInRealtime,
  useCreateCheckIn,
  useFacialCheckIn,
  visitsApi,
  ActivityLogDrawer,
  QRScanner,
  FaceScanner,
  type CheckInResponse,
} from '@/features/checkins';
import { KioskSuccessHero } from '@/features/checkins/kiosk/KioskSuccessHero';
import { KioskDenialScreen } from '@/features/checkins/kiosk/KioskDenialScreen';
import { KioskPinLock } from '@/features/checkins/kiosk/KioskPinLock';
import { KioskMisconfigured } from '@/features/checkins/kiosk/KioskMisconfigured';
import { useKioskSound } from '@/features/checkins/kiosk/use-kiosk-sound';
import { useIdleLock } from '@/features/checkins/kiosk/use-idle-lock';

/**
 * Kiosk — Edge-to-edge entrance display.
 *
 * Route param `branchSlug` is currently the branch UUID. Operators
 * configure the kiosk URL once: /kiosk/<branch-uuid>. Studio context
 * is implicit from the staff JWT (set at install time).
 *
 * Three modes alternate on a single screen: QR scan (default), Face
 * scan, and tap-fallback for members without either. After every
 * result we play a sound, show a 3s hero (success) or 5s denial
 * screen, then return to idle scanning automatically.
 *
 * Exit requires a 4-digit PIN that the staff sets on first launch.
 * Idle for 5 minutes → also requires PIN to wake.
 */
export default function KioskPage() {
  const params = useParams();
  const branchId = params.branchSlug as string;
  const user = useAuthStore((s) => s.user);
  const studio = useAuthStore((s) => s.studio);
  const studioId = user?.studio_id;
  const gymSlug = studio?.slug ?? '';

  // Branch lookup for the footer label. We also use the error/success
  // signal to detect a misconfigured kiosk URL (bad branch UUID) and
  // surface that loudly instead of silently degrading.
  const { data: branch, isError: branchError, isLoading: branchLoading } = useQuery({
    queryKey: ['kiosk-branch', branchId],
    queryFn: () => branchesApi.get(branchId),
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const branchMisconfigured = !!branchId && !branchLoading && (!branch || branchError);

  // ── State ──────────────────────────────────────────────────────
  // direction: which gate is this tablet pinned to? Staff sets it once per
  // session — Check In for the entrance tablet, Check Out for the exit tablet.
  // Persisted to localStorage per branch so the choice survives reloads.
  const [direction, setDirectionState] = useState<'in' | 'out'>('in');
  const setDirection = useCallback(
    (d: 'in' | 'out') => {
      setDirectionState(d);
      if (typeof window !== 'undefined' && branchId) {
        window.localStorage.setItem(`kiosk-direction:${branchId}`, d);
      }
    },
    [branchId],
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !branchId) return;
    const saved = window.localStorage.getItem(`kiosk-direction:${branchId}`);
    if (saved === 'in' || saved === 'out') setDirectionState(saved);
  }, [branchId]);

  const [mode, setMode] = useState<'qr' | 'face'>('qr');
  const [success, setSuccess] = useState<{
    name: string;
    code?: string | null;
    photo?: string | null;
    membershipStatus?: string | null;
  } | null>(null);
  const [denial, setDenial] = useState<{
    name: string | null;
    reason: string | null;
    message: string | null;
  } | null>(null);
  const [pinScreen, setPinScreen] = useState<{ setup: boolean } | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [requestingExit, setRequestingExit] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sound = useKioskSound(true);
  const createCheckIn = useCreateCheckIn();
  const facialCheckIn = useFacialCheckIn();
  const checkOutMutation = useMutation({
    mutationFn: (data: { member_id?: string; qr_code?: string }) =>
      visitsApi.checkOut({ ...data, branch_id: branchId }),
  });
  const { status: rtStatus } = useCheckInRealtime({ branchId, enabled: !!branchId });

  // Online/offline detection.
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // First-launch: if no PIN is set for this branch, ask staff to set one.
  useEffect(() => {
    if (typeof window === 'undefined' || !branchId) return;
    const stored = window.localStorage.getItem(`kiosk-pin:${branchId}`);
    if (!stored) setPinScreen({ setup: true });
  }, [branchId]);

  // Idle lock — relocks after 5 min of inactivity.
  useIdleLock({
    idleMs: 5 * 60 * 1000,
    enabled: !pinScreen,
    onIdle: () => setPinScreen({ setup: false }),
  });

  // ── Result handlers ────────────────────────────────────────────
  const showResult = useCallback(
    (res: CheckInResponse) => {
      if (res && (res as { success?: boolean }).success === true) {
        const r = res as {
          success: true;
          check_in?: { member?: { full_name?: string; member_code?: string; profile_photo_url?: string | null } };
          member_name?: string;
          membership_status?: string;
        };
        const name = r.check_in?.member?.full_name ?? r.member_name ?? 'Member';
        sound.playSuccess();
        setSuccess({
          name,
          code: r.check_in?.member?.member_code ?? null,
          photo: r.check_in?.member?.profile_photo_url ?? null,
          membershipStatus: r.membership_status ?? null,
        });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const r = res as { failure_reason?: string; message?: string; member_name?: string };
        sound.playDenial();
        setDenial({
          name: r.member_name ?? null,
          reason: r.failure_reason ?? 'denied',
          message: r.message ?? 'Check-in could not be completed',
        });
        setTimeout(() => setDenial(null), 5000);
      }
    },
    [sound],
  );

  // Adapt the check-out response into the same shape as a check-in result so
  // the success/denial overlays can render uniformly.
  const showCheckOutResult = useCallback(
    (res: Awaited<ReturnType<typeof visitsApi.checkOut>>) => {
      if (res.success && res.check_in) {
        const ci = res.check_in as {
          member?: { full_name?: string; member_code?: string; profile_photo_url?: string | null };
        };
        const name = ci.member?.full_name ?? res.member_name ?? 'Member';
        sound.playSuccess();
        setSuccess({
          name,
          code: ci.member?.member_code ?? res.member_code ?? null,
          photo: ci.member?.profile_photo_url ?? null,
          // Re-use the membership status slot to surface duration on check-out.
          membershipStatus: res.already_checked_out
            ? 'Already checked out'
            : res.duration_minutes != null
              ? `Session ${res.duration_minutes} min`
              : 'Checked out',
        });
        setTimeout(() => setSuccess(null), 3000);
        return;
      }
      sound.playDenial();
      setDenial({
        name: null,
        reason: res.failure_reason ?? 'no_open_visit',
        message:
          res.message ??
          'No open check-in found — the member may not be inside, or already checked out.',
      });
      setTimeout(() => setDenial(null), 5000);
    },
    [sound],
  );

  const handleQrScan = useCallback(
    (qrCode: string) => {
      if (!branchId) return;
      sound.playChirp();
      if (direction === 'out') {
        checkOutMutation.mutate({ qr_code: qrCode }, { onSuccess: showCheckOutResult });
        return;
      }
      createCheckIn.mutate(
        {
          qr_code: qrCode,
          branch_id: branchId,
          checkin_method: 'qr',
          source: 'kiosk',
          client_event_id: crypto.randomUUID(),
        },
        { onSuccess: showResult },
      );
    },
    [branchId, direction, createCheckIn, checkOutMutation, showResult, showCheckOutResult, sound],
  );

  const handleFaceMatch = useCallback(
    (descriptor: number[]) => {
      if (!branchId) return;
      sound.playChirp();
      if (direction === 'out') {
        // Face-API check-out: identify first to get member_id, then close the visit.
        // We re-use the facial check-in mutation which returns matched_member_id
        // even when the orchestrator rejects (it still resolves the face). For
        // a cleaner path, send the descriptor through facial check-in, then
        // if it returned a match, do the check-out by member_id.
        facialCheckIn.mutate(
          { descriptor, branch_id: branchId },
          {
            onSuccess: (res) => {
              const memberId =
                (res as { matched_member_id?: string }).matched_member_id ??
                (res as { check_in?: { member_id?: string } }).check_in?.member_id;
              if (!memberId) {
                sound.playDenial();
                setDenial({
                  name: null,
                  reason: 'no_match',
                  message: "We couldn't recognize that face. Try again or use QR.",
                });
                setTimeout(() => setDenial(null), 5000);
                return;
              }
              checkOutMutation.mutate(
                { member_id: memberId },
                { onSuccess: showCheckOutResult },
              );
            },
          },
        );
        return;
      }
      facialCheckIn.mutate(
        { descriptor, branch_id: branchId },
        { onSuccess: showResult },
      );
    },
    [branchId, direction, facialCheckIn, checkOutMutation, showResult, showCheckOutResult, sound],
  );

  // ── PIN long-press to exit ─────────────────────────────────────
  const onLockPressStart = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setRequestingExit(true);
      setPinScreen({ setup: false });
    }, 1500);
  }, []);
  const onLockPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const branchName = (branch as { name?: string } | undefined)?.name ?? 'this branch';
  const branchOpenClose = branch as { opening_time?: string; closing_time?: string } | undefined;
  const rtIndicator = rtStatus === 'connected' ? 'Live' : rtStatus === 'connecting' ? 'Connecting…' : 'Offline';

  // PIN screen takes the whole viewport.
  if (pinScreen) {
    return (
      <KioskPinLock
        storageKey={branchId}
        setupMode={pinScreen.setup}
        onUnlock={() => {
          setPinScreen(null);
          if (requestingExit) {
            setRequestingExit(false);
            window.location.href = studioId ? `/` : '/login';
          }
        }}
        onCancel={() => {
          setPinScreen(null);
          setRequestingExit(false);
        }}
      />
    );
  }

  // Misconfigured: branch UUID in URL doesn't resolve. Surface loudly
  // instead of silently degrading. Long-press still allows exit.
  if (branchMisconfigured) {
    return (
      <KioskMisconfigured
        branchId={branchId}
        onExitRequest={() => {
          setRequestingExit(true);
          setPinScreen({ setup: false });
        }}
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-ink text-on-primary">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <button
            onPointerDown={onLockPressStart}
            onPointerUp={onLockPressEnd}
            onPointerLeave={onLockPressEnd}
            aria-label="Long-press to exit kiosk"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-on-primary/10 text-on-primary/80 transition duration-fast hover:bg-on-primary/20 hover:text-on-primary active:scale-95"
            title="Long-press (1.5s) to exit kiosk mode"
          >
            <Lock className="h-5 w-5" />
          </button>
          <div>
            <div className="text-xs uppercase tracking-widest text-on-primary/40">Welcome to</div>
            <div className="text-2xl font-semibold tracking-tight">{branchName}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm text-on-primary/60">
          <button
            onClick={() => setLogOpen(true)}
            aria-label="Open activity log"
            className="inline-flex items-center gap-2 rounded-full bg-on-primary/10 px-3.5 py-2 text-on-primary/70 hover:bg-on-primary/20 hover:text-on-primary transition-colors duration-fast"
          >
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline text-sm">Log</span>
          </button>
          <span
            role="status"
            aria-label={`Realtime connection: ${rtIndicator}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors duration-fast ${
              rtStatus === 'connected'
                ? 'bg-success/20 text-success-foreground'
                : 'bg-on-primary/10 text-on-primary/70'
            }`}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {rtIndicator}
          </span>
        </div>
      </header>

      <ActivityLogDrawer
        open={logOpen}
        onOpenChange={setLogOpen}
        branchId={branchId}
        historyHref={gymSlug ? `/${gymSlug}/check-in/history` : '#'}
      />

      {/* Direction toggle — pin this tablet to the entrance (Check In) or exit
          (Check Out). Big, deliberately persistent: staff sets once per device. */}
      <div className="flex justify-center px-8">
        <div
          role="tablist"
          aria-label="Kiosk direction"
          className="inline-flex rounded-full bg-on-primary/10 p-1"
        >
          <DirectionTab
            active={direction === 'in'}
            onClick={() => setDirection('in')}
            icon={<LogIn className="h-5 w-5" />}
            label="Check In"
            tone="success"
          />
          <DirectionTab
            active={direction === 'out'}
            onClick={() => setDirection('out')}
            icon={<LogOut className="h-5 w-5" />}
            label="Check Out"
            tone="link"
          />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex justify-center gap-2 px-8 mt-3">
        <ModeTab active={mode === 'qr'} onClick={() => setMode('qr')} icon={<QrIcon className="h-5 w-5" />} label="Scan QR" />
        <ModeTab active={mode === 'face'} onClick={() => setMode('face')} icon={<ScanFace className="h-5 w-5" />} label="Face ID" />
      </div>

      {/* Scanner panel — translucent canvas-soft wash so the card visibly
          separates from the ink background instead of fading into it. */}
      <main className="flex flex-1 flex-col items-center justify-center px-8 py-6">
        <div className="w-full max-w-3xl rounded-3xl border border-on-primary/15 bg-on-primary/[0.04] p-8 shadow-level-5 backdrop-blur-sm">
          {mode === 'qr' && (
            <div className="space-y-4">
              <h2 className="text-center text-3xl font-semibold">
                {direction === 'in' ? 'Show your QR code to check in' : 'Show your QR code to check out'}
              </h2>
              <p className="text-center text-on-primary/60">Hold it up to the camera below.</p>
              <div className="mx-auto max-w-md">
                <QRScanner
                  onScan={handleQrScan}
                  isPending={createCheckIn.isPending || checkOutMutation.isPending}
                  tone="dark"
                />
              </div>
            </div>
          )}

          {mode === 'face' && (
            <div className="space-y-4">
              <h2 className="text-center text-3xl font-semibold">
                {direction === 'in' ? 'Look at the camera to check in' : 'Look at the camera to check out'}
              </h2>
              <p className="text-center text-on-primary/60">Stand still — we&apos;ll do the rest.</p>
              <div className="mx-auto max-w-md">
                <FaceScanner
                  onMatch={handleFaceMatch}
                  isPending={facialCheckIn.isPending || checkOutMutation.isPending}
                  tone="dark"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-8 py-4 text-xs text-on-primary/40">
        <div>
          {branchOpenClose?.opening_time && branchOpenClose?.closing_time
            ? `Open ${branchOpenClose.opening_time} – ${branchOpenClose.closing_time}`
            : 'Have a great session'}
        </div>
        <div className="opacity-50">Long-press the lock icon to exit</div>
      </footer>

      {/* Success / Denial overlays */}
      {success && (
        <KioskSuccessHero
          memberName={success.name}
          memberCode={success.code ?? null}
          photoUrl={success.photo ?? null}
          membershipStatus={success.membershipStatus ?? null}
          visible
        />
      )}
      {denial && (
        <KioskDenialScreen
          memberName={denial.name}
          denialReason={denial.reason}
          message={denial.message}
          visible
        />
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full px-6 py-3 text-base font-medium transition duration-fast active:scale-[0.98] ${
        active
          ? 'bg-success text-success-foreground shadow-level-3'
          : 'bg-on-primary/10 text-on-primary/70 hover:bg-on-primary/20 hover:text-on-primary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DirectionTab({
  active,
  onClick,
  icon,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: 'success' | 'link';
}) {
  // Tone differentiates entry (green) vs exit (blue) so staff can see at a
  // glance which gate the tablet is pinned to.
  const activeBg =
    tone === 'success'
      ? 'bg-success text-success-foreground'
      : 'bg-link text-link-foreground';
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-7 py-3 text-base font-semibold transition duration-fast active:scale-[0.98] ${
        active
          ? `${activeBg} shadow-level-3`
          : 'text-on-primary/70 hover:text-on-primary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
