"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { FormInput } from "@/components/shared";
import { toast } from "sonner";
import {
  ArrowLeft,
  CreditCard,
  Mail,
  MessageSquare,
  Phone,
  Bot,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: typeof CreditCard;
  category: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
  connected: boolean;
}

const integrations: Integration[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    description: "Accept payments via UPI, cards, netbanking (India)",
    icon: CreditCard,
    category: "Payments",
    fields: [
      {
        key: "key_id",
        label: "Key ID",
        placeholder: "rzp_live_xxxxxxxxxx",
      },
      {
        key: "key_secret",
        label: "Key Secret",
        placeholder: "••••••••",
        type: "password",
      },
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        placeholder: "••••••••",
        type: "password",
      },
    ],
    connected: false,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "International payment processing",
    icon: CreditCard,
    category: "Payments",
    fields: [
      {
        key: "publishable_key",
        label: "Publishable Key",
        placeholder: "pk_live_xxxxxxxxxx",
      },
      {
        key: "secret_key",
        label: "Secret Key",
        placeholder: "sk_live_xxxxxxxxxx",
        type: "password",
      },
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        placeholder: "whsec_xxxxxxxxxx",
        type: "password",
      },
    ],
    connected: false,
  },
  {
    id: "resend",
    name: "Resend",
    description: "Transactional and marketing emails",
    icon: Mail,
    category: "Messaging",
    fields: [
      {
        key: "api_key",
        label: "API Key",
        placeholder: "re_xxxxxxxxxx",
        type: "password",
      },
      {
        key: "from_email",
        label: "From Email",
        placeholder: "noreply@yourgym.com",
      },
    ],
    connected: false,
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS notifications and alerts",
    icon: Phone,
    category: "Messaging",
    fields: [
      {
        key: "account_sid",
        label: "Account SID",
        placeholder: "ACxxxxxxxxxx",
      },
      {
        key: "auth_token",
        label: "Auth Token",
        placeholder: "••••••••",
        type: "password",
      },
      {
        key: "phone_number",
        label: "Phone Number",
        placeholder: "+1234567890",
      },
    ],
    connected: false,
  },
  {
    id: "whatsapp",
    name: "Meta WhatsApp",
    description: "WhatsApp Business messaging via Cloud API",
    icon: MessageSquare,
    category: "Messaging",
    fields: [
      {
        key: "phone_number_id",
        label: "Phone Number ID",
        placeholder: "1234567890",
      },
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "••••••••",
        type: "password",
      },
    ],
    connected: false,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "AI-powered advisor and daily briefings",
    icon: Bot,
    category: "AI",
    fields: [
      {
        key: "api_key",
        label: "API Key",
        placeholder: "sk-ant-xxxxxxxxxx",
        type: "password",
      },
    ],
    connected: false,
  },
];

export default function IntegrationsPage() {
  const { gymPath } = useGymSlug();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);

  const handleSave = (integrationId: string) => {
    setConnectedIds((prev) => prev.includes(integrationId) ? prev : [...prev, integrationId]);
    setExpandedId(null);
    toast.success("Integration saved");
  };

  const categories = Array.from(new Set(integrations.map((i) => i.category)));

  return (
    <AppLayout>
      <Link
        href={gymPath("/settings")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services to your studio
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="mb-6">
          <h2 className="text-base font-semibold text-foreground mb-3">{category}</h2>
          <div className="space-y-3">
            {integrations
              .filter((i) => i.category === category)
              .map((integration) => {
                const Icon = integration.icon;
                const isConnected = connectedIds.includes(integration.id);
                const isExpanded = expandedId === integration.id;

                return (
                  <div
                    key={integration.id}
                    className="bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : integration.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">
                            {integration.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {integration.description}
                          </p>
                        </div>
                      </div>
                      {isConnected ? (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Not connected
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border p-4 space-y-3">
                        {integration.fields.map((field) => (
                          <FormInput
                            key={field.key}
                            label={field.label}
                            type={field.type || "text"}
                            placeholder={field.placeholder}
                          />
                        ))}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleSave(integration.id)}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                          >
                            Save & Connect
                          </button>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </AppLayout>
  );
}
