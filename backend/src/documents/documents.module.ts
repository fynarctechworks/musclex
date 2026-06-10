import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentRendererService } from './document-renderer.service';
import { DocumentDeliveryService } from './document-delivery.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentRendererService, DocumentDeliveryService],
  exports: [DocumentsService, DocumentRendererService, DocumentDeliveryService],
})
export class DocumentsModule {}
