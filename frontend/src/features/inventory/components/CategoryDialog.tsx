'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCategory, useUpdateCategory } from '../hooks';
import type { ProductCategory } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: ProductCategory | null;
}

export function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isEdit = !!category;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
    },
  });

  React.useEffect(() => {
    if (category) {
      reset({ name: category.name, description: category.description || '' });
    } else {
      reset({ name: '', description: '' });
    }
  }, [category, reset]);

  const onSubmit = (values: FormValues) => {
    if (isEdit && category) {
      updateCategory.mutate(
        { id: category.id, data: { name: values.name, description: values.description || undefined } },
        { onSuccess: () => { reset(); onOpenChange(false); } },
      );
    } else {
      createCategory.mutate(
        { name: values.name, description: values.description || undefined },
        { onSuccess: () => { reset(); onOpenChange(false); } },
      );
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? 'Edit Category' : 'Add Category'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Name *</Label>
            <Input
              {...register('name')}
              placeholder="e.g. Supplements, Apparel"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Description</Label>
            <Textarea
              {...register('description')}
              placeholder="Optional description..."
              rows={2}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground resize-none"
            />
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
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isPending ? 'Saving...' : isEdit ? 'Save' : 'Add Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
