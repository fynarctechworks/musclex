"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const schema = z.object({
  photo_url: z.string().url("Must be a valid URL").min(1, "Photo URL is required"),
  caption: z.string().optional(),
  photo_type: z.enum(["before", "after", "progress"]),
  taken_at: z.string().min(1, "Date is required"),
});

type FormData = z.infer<typeof schema>;

interface PhotoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

export function PhotoUploadDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: PhotoUploadDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      photo_type: "progress",
      taken_at: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Progress Photo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="photo_url">Photo URL</Label>
            <Input
              id="photo_url"
              type="url"
              placeholder="https://example.com/photo.jpg"
              {...register("photo_url")}
              className="mt-1 bg-muted border-border"
            />
            {errors.photo_url && (
              <p className="text-xs text-destructive mt-1">{errors.photo_url.message}</p>
            )}
          </div>

          <div>
            <Label>Photo Type</Label>
            <Select
              value={watch("photo_type")}
              onValueChange={(v) => setValue("photo_type", v as FormData["photo_type"])}
            >
              <SelectTrigger className="mt-1 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="after">After</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="taken_at">Date Taken</Label>
            <Input
              id="taken_at"
              type="date"
              {...register("taken_at")}
              className="mt-1 bg-muted border-border"
            />
            {errors.taken_at && (
              <p className="text-xs text-destructive mt-1">{errors.taken_at.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="caption">Caption (optional)</Label>
            <Textarea
              id="caption"
              placeholder="e.g. Front pose — Week 4"
              {...register("caption")}
              className="mt-1 bg-muted border-border resize-none"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Uploading…" : "Add Photo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
