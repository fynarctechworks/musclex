'use client';

import { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BackupCodesModalProps {
  open: boolean;
  codes: string[];
  onClose: () => void;
}

export function BackupCodesModal({ open, codes, onClose }: BackupCodesModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = codes.join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = [
      'FitSync Pro — Two-Factor Authentication Backup Codes',
      '=====================================================',
      '',
      'Store these codes in a safe place. Each code can only be used once.',
      '',
      ...codes.map((code, i) => `${i + 1}. ${code}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fitsync-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Save Your Backup Codes
          </DialogTitle>
          <DialogDescription>
            Store these codes in a safe place. If you lose access to your
            authenticator app, you can use a backup code to sign in. Each code
            can only be used once.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 bg-secondary p-4 rounded-lg border border-border">
          {codes.map((code, i) => (
            <div
              key={i}
              className="font-mono text-sm text-foreground text-center py-1.5 px-2 bg-card rounded"
            >
              {code}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-1.5 text-primary" />
            ) : (
              <Copy className="h-4 w-4 mr-1.5" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
        </div>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="w-full"
          >
            I&apos;ve saved my backup codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
