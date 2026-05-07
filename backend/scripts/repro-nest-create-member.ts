/**
 * Boots the compiled Nest app in-process and calls MembersService.create()
 * to expose the real error stack behind the 500.
 */
import { NestFactory } from '@nestjs/core';
import 'dotenv/config';

async function main() {
  const studioId = process.argv[2] || '17b22e99-dd2a-49f7-8b64-63b3645bf588';
  const branchId = process.argv[3] || '3a109352-ced9-4241-906c-2450c7393bd8';
  const orgId = process.argv[4] || '86fe6125-c376-4a08-b935-f0f9044cf7fb';

  const { AppModule } = require('../dist/app.module');
  const { MembersService } = require('../dist/members/members.service');
  const { tenantContext } = require('../dist/common/tenant-context');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const service = app.get(MembersService);

  // Look up schema_name for studio
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const prisma = app.get(PrismaService);
  const studios = await prisma.$queryRawUnsafe(
    `SELECT schema_name FROM public.studios WHERE id = $1::uuid LIMIT 1`,
    studioId,
  );
  const schemaName = (studios as any[])[0]?.schema_name;
  console.log('Using schemaName:', schemaName);

  const dto = {
    full_name: 'Nest Repro Member',
    phone: `+9199${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`,
    branch_id: branchId,
    organization_id: orgId,
    status: 'active',
  };

  await new Promise<void>((resolve) => {
    tenantContext.run({ schemaName, gymId: studioId }, async () => {
      try {
        const result = await service.create(studioId, dto);
        console.log('\n✓ SUCCESS:', JSON.stringify(result, null, 2).slice(0, 800));
      } catch (e: any) {
        console.log('\n✗ FAILED:', e.constructor.name, '-', e.message);
        console.log('Stack:', e.stack);
        if (e.cause) console.log('Cause:', e.cause);
        if (e.meta) console.log('Meta:', e.meta);
      }
      resolve();
    });
  });

  await app.close();
}

main().catch((e) => { console.error('outer', e); process.exit(1); });
