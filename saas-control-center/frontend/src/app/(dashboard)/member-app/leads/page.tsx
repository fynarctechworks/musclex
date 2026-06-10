'use client';

import { PageHeader } from '@/components/layout/page-header';
import { UsersTable } from '@/components/member-app/users-table';

export default function LeadsPage() {
  return (
    <div>
      <PageHeader
        title="Leads"
        description="Registered app users who haven't joined a gym yet"
      />
      <UsersTable type="leads" showExport />
    </div>
  );
}
