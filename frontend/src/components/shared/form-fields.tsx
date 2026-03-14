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

// Shared field wrapper
interface FieldWrapperProps {
  label?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldWrapper({ label, error, children, className }: FieldWrapperProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-[13px] font-medium text-foreground">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Styled Input
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error}>
      <Input
        ref={ref}
        className={cn(
          "h-9 bg-secondary border-border text-foreground text-[13px] placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30",
          error && "border-destructive",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  )
);
FormInput.displayName = "FormInput";

// Styled Select
interface FormSelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}

export function FormSelect({
  label,
  error,
  placeholder = "Select...",
  value,
  onValueChange,
  options,
  className,
}: FormSelectProps) {
  return (
    <FieldWrapper label={label} error={error} className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={cn(
            "h-9 bg-secondary border-border text-foreground text-[13px]",
            error && "border-destructive"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="text-popover-foreground text-[13px] focus:bg-accent"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

// Styled Textarea
interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error}>
      <Textarea
        ref={ref}
        className={cn(
          "bg-secondary border-border text-foreground text-[13px] placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 min-h-[80px]",
          error && "border-destructive",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  )
);
FormTextarea.displayName = "FormTextarea";

// Date Picker (simple input type="date" styled for dark theme)
interface FormDatePickerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const FormDatePicker = forwardRef<HTMLInputElement, FormDatePickerProps>(
  ({ label, error, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error}>
      <Input
        ref={ref}
        type="date"
        className={cn(
          "h-9 bg-secondary border-border text-foreground text-[13px] focus:border-primary focus:ring-1 focus:ring-primary/30",
          error && "border-destructive",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  )
);
FormDatePicker.displayName = "FormDatePicker";

// File Upload
interface FormFileUploadProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const FormFileUpload = forwardRef<HTMLInputElement, FormFileUploadProps>(
  ({ label, error, className, ...props }, ref) => (
    <FieldWrapper label={label} error={error}>
      <Input
        ref={ref}
        type="file"
        className={cn(
          "h-9 bg-secondary border-border text-foreground text-[13px] file:bg-muted file:text-muted-foreground file:border-0 file:mr-3 file:px-3 file:rounded-md cursor-pointer",
          error && "border-destructive",
          className
        )}
        {...props}
      />
    </FieldWrapper>
  )
);
FormFileUpload.displayName = "FormFileUpload";
