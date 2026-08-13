"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTemplate } from "../hooks";
import {
  CHANNEL_LABEL,
  TEMPLATE_VARIABLES,
  type TemplateChannel,
} from "../types";

export function TemplateFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<TemplateChannel>("whatsapp");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const createMutation = useCreateTemplate();

  useEffect(() => {
    if (open) {
      setName("");
      setChannel("whatsapp");
      setSubject("");
      setContent("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!name.trim() || !content.trim()) return;
    createMutation.mutate(
      {
        template_name: name.trim(),
        channel,
        subject: channel === "email" && subject.trim() ? subject.trim() : undefined,
        content: content.trim(),
        // Record which supported variables the body actually uses.
        variables: TEMPLATE_VARIABLES.filter((v) => content.includes(v)).map((v) =>
          v.replace(/[{}]/g, ""),
        ),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Message Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Expiry reminder"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
              <SelectTrigger className="bg-muted border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(Object.keys(CHANNEL_LABEL) as TemplateChannel[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {channel === "email" && (
            <div className="space-y-1.5">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your membership expires soon"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="template-content">Message</Label>
            <Textarea
              id="template-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder={"Hi {{member_name}}, your {{plan_name}} expires on {{expiry_date}} — only {{days_left}} days left!"}
            />
            <p className="text-[11px] leading-4 text-muted-foreground">
              Supported variables:{" "}
              <code className="font-mono">{TEMPLATE_VARIABLES.join(" ")}</code>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !name.trim() || !content.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {createMutation.isPending ? "Creating…" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
