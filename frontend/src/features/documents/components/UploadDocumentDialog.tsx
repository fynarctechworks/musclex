"use client";

import React, { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: "waiver", label: "Liability Waiver" },
  { value: "medical_clearance", label: "Medical Clearance" },
  { value: "fitness_assessment", label: "Fitness Assessment" },
  { value: "id_proof", label: "ID Proof" },
  { value: "other", label: "Other" },
] as const;

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg";
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  document_type: z.string().min(1, "Document type is required"),
  file_url: z.string().url("Must be a valid URL").min(1, "File URL is required"),
  file_name: z.string().optional(),
  description: z.string().optional(),
  expires_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: UploadDocumentDialogProps) {
  const [dragOver, setDragOver] = useState(false);

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
      document_type: "waiver",
    },
  });

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `Invalid file type "${file.type}". Allowed: PDF, PNG, JPG, WEBP.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 5 MB.`;
    }
    return null;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const error = validateFile(file);
        if (error) {
          alert(error);
          return;
        }
        setValue("file_name", file.name);
        // In production, you'd upload to Supabase Storage here and set file_url
        // For now, create an object URL as placeholder
        setValue("file_url", URL.createObjectURL(file));
      }
    },
    [setValue, validateFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const error = validateFile(file);
        if (error) {
          alert(error);
          e.target.value = "";
          return;
        }
        setValue("file_name", file.name);
        setValue("file_url", URL.createObjectURL(file));
      }
    },
    [setValue, validateFile]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("doc-file-input")?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              Drag & drop a file, or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG</p>
            <input
              id="doc-file-input"
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Or paste URL directly */}
          <div>
            <Label htmlFor="file_url">Or paste file URL</Label>
            <Input
              id="file_url"
              type="url"
              placeholder="https://storage.example.com/document.pdf"
              {...register("file_url")}
              className="mt-1 bg-muted border-border"
            />
            {errors.file_url && (
              <p className="text-xs text-destructive mt-1">{errors.file_url.message}</p>
            )}
          </div>

          <div>
            <Label>Document Type</Label>
            <Select
              value={watch("document_type")}
              onValueChange={(v) => setValue("document_type", v)}
            >
              <SelectTrigger className="mt-1 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.document_type && (
              <p className="text-xs text-destructive mt-1">{errors.document_type.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="doc-description">Description (optional)</Label>
            <Textarea
              id="doc-description"
              placeholder="e.g. Annual medical clearance from Dr. Smith"
              {...register("description")}
              className="mt-1 bg-muted border-border resize-none"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="expires_at">Expiration Date (optional)</Label>
            <Input
              id="expires_at"
              type="date"
              {...register("expires_at")}
              className="mt-1 bg-muted border-border"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Uploading…" : "Upload Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
