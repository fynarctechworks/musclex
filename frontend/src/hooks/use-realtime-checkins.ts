// NOTE: Enable Realtime in Supabase Dashboard > Database > Replication for the check_ins table

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CheckInEvent {
  id: string;
  member_id: string;
  membership_id: string;
  branch_id: string;
  class_id: string | null;
  checkin_method: string;
  checked_in_at: string;
  status: string;
  failure_reason: string | null;
  created_at: string;
  [key: string]: unknown;
}

export function useRealtimeCheckIns() {
  const [latestCheckIn, setLatestCheckIn] = useState<CheckInEvent | null>(null);
  const [checkInCount, setCheckInCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('check-ins-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'check_ins' },
        (payload) => {
          setLatestCheckIn(payload.new as CheckInEvent);
          setCheckInCount((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const resetCount = useCallback(() => setCheckInCount(0), []);

  return { latestCheckIn, checkInCount, isConnected, resetCount };
}
