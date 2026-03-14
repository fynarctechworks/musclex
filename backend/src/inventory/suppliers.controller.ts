import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SuppliersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  // ── Suppliers ─────────────────────────────────────────────────

  @Post('suppliers')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'create' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.purchaseOrdersService.createSupplier(dto);
  }

  @Get('suppliers')
  @Permissions({ module: 'inventory', action: 'view' })
  findAllSuppliers(
    @Query('organization_id') organizationId?: string,
    @Query('is_active') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.purchaseOrdersService.findAllSuppliers({
      organization_id: organizationId,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('suppliers/:id')
  @Permissions({ module: 'inventory', action: 'view' })
  findOneSupplier(@Param('id') id: string) {
    return this.purchaseOrdersService.findOneSupplier(id);
  }

  @Patch('suppliers/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.purchaseOrdersService.updateSupplier(id, dto);
  }

  // ── Purchase Orders ───────────────────────────────────────────

  @Post('purchase-orders')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'create' })
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.createPurchaseOrder(dto);
  }

  @Get('purchase-orders')
  @Permissions({ module: 'inventory', action: 'view' })
  findAllOrders(
    @Query('branch_id') branchId?: string,
    @Query('supplier_id') supplierId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.purchaseOrdersService.findAllOrders({
      branch_id: branchId,
      supplier_id: supplierId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('purchase-orders/:id')
  @Permissions({ module: 'inventory', action: 'view' })
  findOneOrder(@Param('id') id: string) {
    return this.purchaseOrdersService.findOneOrder(id);
  }

  @Post('purchase-orders/:id/receive')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  receivePurchaseOrder(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.purchaseOrdersService.receivePurchaseOrder(id, dto);
  }

  @Patch('purchase-orders/:id/cancel')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  cancelOrder(@Param('id') id: string) {
    return this.purchaseOrdersService.cancelOrder(id);
  }
}
