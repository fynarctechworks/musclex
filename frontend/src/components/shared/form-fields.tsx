"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * Form field family — Design.md `form-input` chrome with label + error
 * wrappers. The underlying Input/Select/Textarea primitives already follow
 * the brand: 40 px height, hairline border, 6 px radius, ink focus ring.
 * These wrappers only add the label / error layout.
 */

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FieldWrapper({
  label,
  error,
  hint,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-sm font-medium text-foreground leading-5">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground leading-4">{hint}</p>
      )}
      {error && <p className="text-xs text-error-deep leading-4">{error}</p>}
    </div>
  );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <Input
        ref={ref}
        aria-invalid={!!error}
        className={className}
        {...props}
      />
    </FieldWrapper>
  )
);
FormInput.displayName = "FormInput";

interface FormSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}

export function FormSelect({
  label,
  error,
  hint,
  required,
  placeholder = "Select...",
  value,
  onValueChange,
  options,
  className,
}: FormSelectProps) {
  return (
    <FieldWrapper
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-invalid={!!error}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter((opt) => opt.value !== "")
            .map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <Textarea
        ref={ref}
        aria-invalid={!!error}
        className={className}
        {...props}
      />
    </FieldWrapper>
  )
);
FormTextarea.displayName = "FormTextarea";

interface FormDatePickerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormDatePicker = forwardRef<HTMLInputElement, FormDatePickerProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <Input
        ref={ref}
        type="date"
        aria-invalid={!!error}
        className={className}
        {...props}
      />
    </FieldWrapper>
  )
);
FormDatePicker.displayName = "FormDatePicker";

interface FormFileUploadProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormFileUpload = forwardRef<HTMLInputElement, FormFileUploadProps>(
  ({ label, error, hint, required, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error} hint={hint} required={required}>
      <Input
        ref={ref}
        type="file"
        aria-invalid={!!error}
        className={cn(
          "file:bg-canvas-soft-2 file:text-foreground file:border-0 file:mr-3 file:px-3 file:rounded-sm file:py-1.5 cursor-pointer",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  )
);
FormFileUpload.displayName = "FormFileUpload";
