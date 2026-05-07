"use client";

import React, { useState } from "react";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { Camera, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import type { ProgressPhoto } from "@/features/progress";

interface ProgressPhotoGalleryProps {
  photos?: ProgressPhoto[];
  loading?: boolean;
  onDelete?: (photoId: string) => void;
  deleteLoading?: boolean;
  className?: string;
}

export function ProgressPhotoGallery({
  photos,
  loading,
  onDelete,
  deleteLoading,
  className,
}: ProgressPhotoGalleryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-36 bg-muted rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted/50 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
        <EmptyState
          icon={Camera}
          title="No progress photos"
          description="Upload your first progress photo to visually track transformation."
        />
      </div>
    );
  }

  const typeColor = (type: string) => {
    switch (type) {
      case "before":
        return "bg-amber-500/20 text-amber-400";
      case "after":
        return "bg-success/20 text-success";
      default:
        return "bg-primary/20 text-primary";
    }
  };

  const viewedPhoto = viewIndex !== null ? photos[viewIndex] : null;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <h3 className="text-base font-semibold text-foreground mb-4">Progress Photos</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <div
            key={photo.id}
            className="group relative aspect-square rounded-lg overflow-hidden border border-border cursor-pointer"
            onClick={() => setViewIndex(idx)}
          >
            <Image
              src={photo.photo_url}
              alt={photo.caption || "Progress photo"}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <div>
                <Badge className={cn("text-[10px]", typeColor(photo.photo_type))}>
                  {photo.photo_type}
                </Badge>
                <p className="text-[10px] text-white mt-0.5">
                  {format(parseISO(photo.taken_at), "MMM dd, yyyy")}
                </p>
              </div>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(photo.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {viewedPhoto && viewIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setViewIndex(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
            onClick={() => setViewIndex(null)}
          >
            <X className="h-5 w-5" />
          </Button>

          {viewIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 text-white hover:bg-white/10 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setViewIndex(viewIndex - 1);
              }}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {viewIndex < photos.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 text-white hover:bg-white/10 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setViewIndex(viewIndex + 1);
              }}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          <div
            className="relative max-w-3xl max-h-[80vh] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={viewedPhoto.photo_url}
              alt={viewedPhoto.caption || "Progress photo"}
              width={800}
              height={800}
              className="object-contain max-h-[80vh] mx-auto rounded-lg"
            />
            <div className="text-center mt-3">
              <Badge className={cn("text-xs", typeColor(viewedPhoto.photo_type))}>
                {viewedPhoto.photo_type}
              </Badge>
              <p className="text-sm text-white/70 mt-1">
                {format(parseISO(viewedPhoto.taken_at), "MMMM dd, yyyy")}
              </p>
              {viewedPhoto.caption && (
                <p className="text-sm text-white mt-1">{viewedPhoto.caption}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Photo"
        description="Are you sure you want to delete this progress photo? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteId && onDelete) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        loading={deleteLoading}
      />
    </div>
  );
}
