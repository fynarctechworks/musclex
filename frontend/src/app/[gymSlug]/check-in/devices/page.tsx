"use client";

import React, { useMemo, useState } from "react";
import { Fingerprint, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { Banner } from "@/components/shared/banner";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useBranches } from "@/features/branches";
import type { Branch } from "@/types";
import {
  useBiometricDevices,
  useRemoveDevice,
  DeviceTable,
  RegisterDeviceDialog,
  MapPinDialog,
} from "@/features/biometric-devices";
import type { BiometricDevice } from "@/features/biometric-devices";

export default function BiometricDevicesPage() {
  const { allowed, checked } = useRequirePermission("check_ins", "view", "deny");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [mapDevice, setMapDevice] = useState<BiometricDevice | null>(null);
  const [removeDevice, setRemoveDevice] = useState<BiometricDevice | null>(null);

  const { data: devices, isLoading } = useBiometricDevices();
  const { data: branches } = useBranches();
  const removeMutation = useRemoveDevice();

  const branchNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of (branches as Branch[] | undefined) ?? []) {
      map[b.id] = b.name;
    }
    return map;
  }, [branches]);

  const deviceList = devices ?? [];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="check_ins" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Check-ins"
          title="Biometric Devices"
          description="Connect eSSL / ZKTeco fingerprint attendance devices so member punches become check-ins automatically."
          actions={
            <Button
              onClick={() => setRegisterOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" /> Register Device
            </Button>
          }
        />

        <Banner
          tone="info"
          title="How device attendance works"
          description={
            <span>
              1) Register the device&apos;s serial number here. 2) On the device,
              set the Cloud Server / ADMS address to this API host (shown after
              registering) — once it connects, the device shows as
              &quot;Receiving&quot;. 3) Map each device user PIN to a member so
              their fingerprint punches check them in — or simply enroll members
              on the device using their member code as the PIN.
            </span>
          }
        />

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : deviceList.length === 0 ? (
          <EmptyState
            icon={Fingerprint}
            title="No devices registered"
            description="Register your first fingerprint attendance device to start receiving punches as check-ins."
            action={
              <Button
                onClick={() => setRegisterOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" /> Register Device
              </Button>
            }
          />
        ) : (
          <DeviceTable
            devices={deviceList}
            branchNames={branchNames}
            onMapPin={(device) => setMapDevice(device)}
            onRemove={(device) => setRemoveDevice(device)}
          />
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}
      <RegisterDeviceDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <MapPinDialog
        open={!!mapDevice}
        onOpenChange={(open) => !open && setMapDevice(null)}
        device={mapDevice}
      />
      <ConfirmDialog
        open={!!removeDevice}
        onOpenChange={(open) => !open && setRemoveDevice(null)}
        title="Remove Device"
        description={`Remove "${removeDevice?.device_name ?? ""}" (serial ${removeDevice?.hardware_id ?? ""})? The device will stop recording check-ins until it is registered again.`}
        confirmLabel="Remove"
        variant="danger"
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (removeDevice) {
            removeMutation.mutate(removeDevice.hardware_id, {
              onSettled: () => setRemoveDevice(null),
            });
          }
        }}
      />
    </AppLayout>
  );
}
