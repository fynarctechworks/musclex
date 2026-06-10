'use client';

import { PageHeader } from '@/components/layout/page-header';
import { UsersTable } from '@/components/member-app/users-table';

export default function CrmPage() {
  return (
    <div>
      <PageHeader
        title="CRM"
        description="Every app user with membership status — for conversion outreach"
      />
      <UsersTable type="crm" />
    </div>
  );
}
