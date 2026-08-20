import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  refresh as apiRefresh,
  signIn as apiSignIn,
  signOut as apiSignOut,
  type SignInResult,
} from './api/auth';
import { setRefreshHandler } from './api/client';

interface SessionValue {
  authed: boolean;
  ready: boolean;
  /** Resolves to 'choose-gym' when the phone belongs to more than one gym. */
  signIn: (phone: string, code: string, tenantId?: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

/** Holds auth state so the router can gate on it without prop-drilling. */
export function SessionProvider({
  initialAuthed,
  children,
}: {
  initialAuthed: boolean;
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(initialAuthed);
  const qc = useQueryClient();

  const signIn = useCallback(
    async (phone: string, code: string, tenantId?: string): Promise<SignInResult> => {
      const result = await apiSignIn(phone, code, tenantId);
      if (result.status === 'signed-in') {
        // The cache belongs to the previous member; never let it leak forward.
        qc.clear();
        setAuthed(true);
      }
      return result;
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await apiSignOut();
    qc.clear();
    setAuthed(false);
  }, [qc]);

  /**
   * On a 401 the client asks for a refresh. If that fails the session is
   * genuinely over, so end it here — otherwise the member is left staring at a
   * screen that will never load, with no way back to sign-in.
   *
   * A refresh that fails because the device is offline returns false too, but
   * `refresh()` only reports false for a *rejected* refresh; network failures
   * are swallowed there so a tunnel does not sign anyone out.
   */
  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const ok = await apiRefresh();
        if (!ok) {
          await apiSignOut();
          qc.clear();
          setAuthed(false);
        }
        return ok;
      } catch {
        return false; // offline — keep the session, the request just fails
      }
    });
    return () => setRefreshHandler(null);
  }, [qc]);

  const value = useMemo(
    () => ({ authed, ready: true, signIn, signOut }),
    [authed, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
