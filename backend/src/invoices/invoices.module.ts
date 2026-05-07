import { Module } from '@nestjs/common';
import { InvoiceTemplatesController } from './invoice-templates.controller';

@Module({
  controllers: [InvoiceTemplatesController],
})
export class InvoicesModule {}
