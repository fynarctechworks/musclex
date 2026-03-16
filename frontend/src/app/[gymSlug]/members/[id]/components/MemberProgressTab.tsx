"use client";

import React, { useState } from "react";
import { Plus, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useBodyStats,
  useProgressSummary,
  useProgressPhotos,
  useCreateBodyStat,
  useUpdateBodyStat,
  useDeleteBodyStat,
  useCreateProgressPhoto,
  useDeleteProgressPhoto,
} from "@/features/progress";
import type { BodyStat, CreateBodyStatPayload, CreateProgressPhotoPayload } from "@/features/progress";
import {
  ProgressSummaryCards,
  MeasurementChart,
  MeasurementTable,
  AddMeasurementDialog,
  EditMeasurementDialog,
  ProgressPhotoGallery,
  PhotoUploadDialog,
} from "@/features/progress/components";

interface MemberProgressTabProps {
  memberId: string;
}

export function MemberProgressTab({ memberId }: MemberProgressTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [editStat, setEditStat] = useState<BodyStat | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  const bodyStats = useBodyStats(memberId);
  const summary = useProgressSummary(memberId);
  const photos = useProgressPhotos(memberId);

  const createStat = useCreateBodyStat(memberId);
  const updateStat = useUpdateBodyStat(memberId);
  const deleteStat = useDeleteBodyStat(memberId);
  const createPhoto = useCreateProgressPhoto(memberId);
  const deletePhoto = useDeleteProgressPhoto(memberId);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <ProgressSummaryCards summary={summary.data} loading={summary.isLoading} />

      {/* Measurement Chart */}
      <MeasurementChart data={bodyStats.data} />

      {/* Measurement Table with header actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Body Measurements</h3>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Measurement
          </Button>
        </div>
        <MeasurementTable
          data={bodyStats.data}
          loading={bodyStats.isLoading}
          onEdit={(stat) => setEditStat(stat)}
          onDelete={(id) => deleteStat.mutate(id)}
          deleteLoading={deleteStat.isPending}
        />
      </div>

      {/* Progress Photos with header actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Transformation Photos</h3>
          <Button size="sm" onClick={() => setPhotoOpen(true)}>
            <Camera className="mr-1.5 h-4 w-4" />
            Add Photo
          </Button>
        </div>
        <ProgressPhotoGallery
          photos={photos.data}
          loading={photos.isLoading}
          onDelete={(id) => deletePhoto.mutate(id)}
          deleteLoading={deletePhoto.isPending}
        />
      </div>

      {/* Dialogs */}
      <AddMeasurementDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(data) =>
          createStat.mutate(data as CreateBodyStatPayload, {
            onSuccess: () => setAddOpen(false),
          })
        }
        loading={createStat.isPending}
      />

      <EditMeasurementDialog
        open={!!editStat}
        onOpenChange={(open) => !open && setEditStat(null)}
        stat={editStat}
        onSubmit={(statsId, data) =>
          updateStat.mutate(
            { statsId, data: data as Partial<CreateBodyStatPayload> },
            { onSuccess: () => setEditStat(null) }
          )
        }
        loading={updateStat.isPending}
      />

      <PhotoUploadDialog
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        onSubmit={(data) =>
          createPhoto.mutate(data as CreateProgressPhotoPayload, {
            onSuccess: () => setPhotoOpen(false),
          })
        }
        loading={createPhoto.isPending}
      />
    </div>
  );
}
