import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { InventoryService } from './inventory.service';
import { PosService } from './pos.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { BatchService } from './batch.service';
import { TransferService } from './transfer.service';
import { BundleService } from './bundle.service';
import { ProductsController } from './products.controller';
import { PosController } from './pos.controller';
import { SuppliersController } from './suppliers.controller';
import { TransfersController } from './transfers.controller';
import { BundlesController } from './bundles.controller';

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [
    ProductsController,
    PosController,
    SuppliersController,
    TransfersController,
    BundlesController,
  ],
  providers: [
    InventoryService,
    PosService,
    PurchaseOrdersService,
    BatchService,
    TransferService,
    BundleService,
  ],
  exports: [
    InventoryService,
    PosService,
    PurchaseOrdersService,
    BatchService,
    TransferService,
    BundleService,
  ],
})
export class InventoryModule {}
