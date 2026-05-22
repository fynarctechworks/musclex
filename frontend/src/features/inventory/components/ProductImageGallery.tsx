'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, X, Star, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useProductImages,
  useAddProductImage,
  useSetPrimaryProductImage,
  useReorderProductImages,
  useRemoveProductImage,
} from '../hooks';

interface ProductImageGalleryProps {
  productId: string;
}

const MAX_IMAGES = 8;

/**
 * Gallery manager for an existing product. Each action commits immediately to
 * the API — there is no draft state — so it is only mounted in edit mode.
 * Uploads go to the shared /uploads/photo endpoint, then the returned URL is
 * attached as a product_images row.
 */
export function ProductImageGallery({ productId }: ProductImageGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: images = [], isLoading } = useProductImages(productId);
  const addImage = useAddProductImage();
  const setPrimary = useSetPrimaryProductImage();
  const reorder = useReorderProductImages();
  const removeImage = useRemoveProductImage();

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/uploads/photo`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Upload failed');
    }
    const data = await res.json();
    return data.url as string;
  }, []);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        toast.error(`Up to ${MAX_IMAGES} images per product`);
        return;
      }
      const selected = Array.from(files).slice(0, room);
      setUploading(true);
      try {
        for (const file of selected) {
          if (!file.type.startsWith('image/')) {
            toast.error(`${file.name} is not an image`);
            continue;
          }
          if (file.size > 5 * 1024 * 1024) {
            toast.error(`${file.name} exceeds 5MB`);
            continue;
          }
          const url = await uploadFile(file);
          await addImage.mutateAsync({ productId, data: { image_url: url } });
        }
        toast.success('Images added');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [images.length, uploadFile, addImage, productId],
  );

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= images.length) return;
    const order = images.map((img) => img.id);
    [order[index], order[target]] = [order[target], order[index]];
    reorder.mutate({ productId, imageIds: order });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground">
          Gallery <span className="text-muted-foreground">({images.length}/{MAX_IMAGES})</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || images.length >= MAX_IMAGES}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 text-[12px]"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-1.5" />
          )}
          Upload
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading images…</p>
      ) : images.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No images yet. The first image you upload becomes the primary thumbnail.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, index) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image_url}
                alt={img.alt_text || 'Product image'}
                className="w-full h-full object-cover"
              />
              {img.is_primary && (
                <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Primary
                </span>
              )}
              <div className="absolute inset-0 flex flex-col justify-between bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex justify-end p-1">
                  <button
                    type="button"
                    onClick={() => removeImage.mutate({ productId, imageId: img.id })}
                    className="h-5 w-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90"
                    title="Remove"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
                <div className="flex items-center justify-between p-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="h-5 w-5 rounded bg-black/70 flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                    title="Move left"
                  >
                    <ChevronLeft className="h-3 w-3 text-white" />
                  </button>
                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={() => setPrimary.mutate({ productId, imageId: img.id })}
                      className="h-5 w-5 rounded bg-black/70 flex items-center justify-center hover:bg-black/90"
                      title="Set as primary"
                    >
                      <Star className="h-3 w-3 text-white" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    className="h-5 w-5 rounded bg-black/70 flex items-center justify-center hover:bg-black/90 disabled:opacity-30"
                    title="Move right"
                  >
                    <ChevronRight className="h-3 w-3 text-white" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const stored = localStorage.getItem('auth-storage');
    if (!stored) return '';
    const parsed = JSON.parse(stored);
    return parsed?.state?.accessToken || '';
  } catch {
    return '';
  }
}
