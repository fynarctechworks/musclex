import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Global SCC email module — the single Resend seam for the Control Center.
 * Mirrors `backend/src/email` so both apps share one provider choice.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
