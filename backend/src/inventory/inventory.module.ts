import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryService } from './inventory.service';
import { PosService } from './pos.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ProductsController } from './products.controller';
import { PosController } from './pos.controller';
import { SuppliersController } from './suppliers.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProductsController, PosController, SuppliersController],
  providers: [InventoryService, PosService, PurchaseOrdersService],
  exports: [InventoryService, PosService, PurchaseOrdersService],
})
export class InventoryModule {}
