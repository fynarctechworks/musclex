'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useBranches } from '@/features/branches';
import type { Branch } from '@/types';
import { useRegisterDevice } from '../hooks';
import type { DeviceVendor, RegisterDeviceResult } from '../types';
import { SERIAL_PATTERN, vendorLabels } from '../types';

interface RegisterDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterDeviceDialog({
  open,
  onOpenChange,
}: RegisterDeviceDialogProps) {
  const registerMutation = useRegisterDevice();
  const { data: branches } = useBranches();
  const branchList = ((branches as Branch[] | undefined) ?? []).filter(
    (b) => b.is_active !== false,
  );

  const [deviceName, setDeviceName] = useState('');
  const [serial, setSerial] = useState('');
  const [vendor, setVendor] = useState<DeviceVendor>('essl');
  const [branchId, setBranchId] = useState('');
  // Populated on success — switches the dialog to the instructions view.
  const [result, setResult] = useState<RegisterDeviceResult | null>(null);

  useEffect(() => {
    if (open) {
      setDeviceName('');
      setSerial('');
      setVendor('essl');
      setBranchId('');
      setResult(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      toast.error('Device name is required');
      return;
    }
    if (!SERIAL_PATTERN.test(serial.trim())) {
      toast.error(
        'Serial must be 4-64 characters (letters, digits, dash, underscore)',
      );
      return;
    }
    if (!branchId) {
      toast.error('Select a branch');
      return;
    }
    registerMutation.mutate(
      {
        serial: serial.trim(),
        branch_id: branchId,
        device_name: deviceName.trim(),
        vendor,
      },
      { onSuccess: (res) => setResult(res) },
    );
  };

  const copyInstructions = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.instructions);
      toast.success('Instructions copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        {result ? (
          // ── Success: setup instructions ──────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Device Registered
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                &quot;{result.device_name}&quot; (serial{' '}
                <span className="font-mono">{result.serial}</span>) is
                registered. Now configure the device so it can reach this
                server:
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted px-3 py-2.5 font-mono text-xs leading-5 text-foreground">
              {result.instructions}
            </pre>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={copyInstructions}
              >
                <Copy className="mr-1.5 h-4 w-4" /> Copy instructions
              </Button>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ── Register form ────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Register Biometric Device
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter the serial number printed on the device (or shown in its
                menu under Device Info). After registering you&apos;ll get the
                server settings to enter on the device.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Device Name</Label>
                <Input
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Front Desk Fingerprint Reader"
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Serial Number</Label>
                <Input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="e.g. AEXC201234567"
                  className="bg-muted border-border font-mono text-foreground placeholder:text-muted-foreground placeholder:font-sans"
                />
                <p className="text-xs text-muted-foreground">
                  4-64 characters — letters, digits, dash or underscore.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-foreground">Vendor</Label>
                  <Select
                    value={vendor}
                    onValueChange={(v) => setVendor(v as DeviceVendor)}
                  >
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder="Vendor" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="essl">{vendorLabels.essl}</SelectItem>
                      <SelectItem value="zkteco">
                        {vendorLabels.zkteco}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {branchList.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {registerMutation.isPending
                    ? 'Registering...'
                    : 'Register Device'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
