"use client";

import { useState } from "react";
import { Country as CSCCountry } from "country-state-city";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FieldWrapper } from "@/components/shared/form-fields";
import { getPhoneMetadata } from "@/lib/location";

/**
 * Global phone input — searchable country dial-code picker + national number.
 * Built on `country-state-city`; emits a combined `${dial}${digits}` E.164 string.
 *
 * Notes:
 *  - `country-state-city` phonecodes can be messy ("1-809 and 1-829 and ...") — we
 *    reduce to the main country code via {@link cleanDial}.
 *  - Flags render as IMAGES (flagcdn) because emoji flags show as letters on
 *    Windows/web. Falls back to the ISO code if the image fails.
 *  - National length is capped per `getPhoneMetadata().maxDigits` (India = 10).
 */
interface PickCountry {
  code: string;
  name: string;
  dial: string;
}

function cleanDial(phonecode?: string): string {
  if (!phonecode) return "";
  const main = phonecode.split(/\s+and\s+/i)[0].split("-")[0].replace(/\D/g, "");
  return main ? `+${main}` : "";
}

const ALL: PickCountry[] = CSCCountry.getAllCountries()
  .map((c) => {
    const raw = c as { isoCode: string; name: string; phonecode?: string };
    return { code: raw.isoCode, name: raw.name, dial: cleanDial(raw.phonecode) };
  })
  .filter((c) => c.dial)
  .sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT = ALL.find((c) => c.code === "IN") ?? ALL[0];

function parsePhone(value: string | undefined | null): { country: PickCountry; national: string } {
  const v = (value ?? "").trim();
  if (!v) return { country: DEFAULT, national: "" };
  const matches = ALL.filter((c) => v.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length);
  if (matches[0]) return { country: matches[0], national: v.slice(matches[0].dial.length).replace(/\D/g, "") };
  return { country: DEFAULT, national: v.replace(/\D/g, "") };
}

function Flag({ code, size = 20 }: { code: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt={code}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      className="shrink-0 rounded-[2px] object-cover ring-1 ring-black/5"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

interface PhoneInputProps {
  /** Stored E.164-ish value, e.g. "+919876543210". */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, onBlur, label, error, required, placeholder }: PhoneInputProps) {
  const { country, national } = parsePhone(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const maxDigits = getPhoneMetadata(country.code).maxDigits;

  const pickCountry = (c: PickCountry) => {
    const trimmed = national.slice(0, getPhoneMetadata(c.code).maxDigits);
    onChange(trimmed ? `${c.dial}${trimmed}` : "");
    setOpen(false);
    setQuery("");
  };
  const setNational = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, maxDigits);
    onChange(digits ? `${country.dial}${digits}` : "");
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? ALL.filter(
        (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q),
      )
    : ALL;

  return (
    <FieldWrapper label={label} error={error} required={required}>
      <div
        className={cn(
          "flex h-10 items-center rounded-sm border bg-card",
          error ? "border-error" : "border-hairline",
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-full shrink-0 items-center gap-1.5 rounded-l-sm border-r border-hairline px-2.5 text-sm hover:bg-canvas-soft"
            >
              <Flag code={country.code} />
              <span className="font-medium text-foreground">{country.dial}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[300px] p-0">
            <div className="border-b border-hairline p-2">
              <Input
                autoFocus
                inputSize="sm"
                placeholder="Search country or code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ScrollArea className="h-64">
              <div className="p-1">
                {filtered.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => pickCountry(c)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-canvas-soft"
                  >
                    <Flag code={c.code} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{c.dial}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">No matches</p>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <input
          type="tel"
          inputMode="tel"
          value={national}
          onChange={(e) => setNational(e.target.value)}
          onBlur={onBlur}
          maxLength={maxDigits}
          placeholder={placeholder ?? "Mobile number"}
          className="h-full min-w-0 flex-1 rounded-r-sm bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </FieldWrapper>
  );
}
