'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ErrorFilters } from '@/hooks/use-system-errors';

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED', 'REOPENED'];
const SOURCES = [
  'FRONTEND',
  'BACKEND',
  'API',
  'DATABASE',
  'PAYMENT',
  'POS',
  'BIOMETRIC',
  'QR',
  'CAMERA',
  'AUTH',
  'NETWORK',
  'SCC',
];
const ENVIRONMENTS = ['PRODUCTION', 'STAGING', 'DEVELOPMENT'];

interface Props {
  filters: ErrorFilters;
  onChange: (partial: Partial<ErrorFilters>) => void;
}

function FilterSelect({
  value,
  placeholder,
  options,
  onValueChange,
}: {
  value: string;
  placeholder: string;
  options: string[];
  onValueChange: (v: string) => void;
}) {
  return (
    <Select
      value={value || 'ALL'}
      onValueChange={(v) => onValueChange(v === 'ALL' || !v ? '' : v)}
    >
      <SelectTrigger className="w-full sm:w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ErrorFiltersBar({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <Input
        placeholder="Search title or message…"
        defaultValue={filters.q ?? ''}
        onChange={(e) => onChange({ q: e.target.value })}
        className="w-full sm:w-64"
      />
      <FilterSelect
        value={filters.severity ?? ''}
        placeholder="All Severities"
        options={SEVERITIES}
        onValueChange={(v) => onChange({ severity: v })}
      />
      <FilterSelect
        value={filters.status ?? ''}
        placeholder="All Statuses"
        options={STATUSES}
        onValueChange={(v) => onChange({ status: v })}
      />
      <FilterSelect
        value={filters.source ?? ''}
        placeholder="All Sources"
        options={SOURCES}
        onValueChange={(v) => onChange({ source: v })}
      />
      <FilterSelect
        value={filters.environment ?? ''}
        placeholder="All Environments"
        options={ENVIRONMENTS}
        onValueChange={(v) => onChange({ environment: v })}
      />
      <Input
        placeholder="Tenant / gym id"
        defaultValue={filters.tenant_id ?? ''}
        onChange={(e) => onChange({ tenant_id: e.target.value })}
        className="w-full sm:w-40"
      />
    </div>
  );
}
