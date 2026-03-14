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
import { InventoryService } from './inventory.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  AdjustInventoryDto,
  UpdateReorderLevelDto,
} from './dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Categories ────────────────────────────────────────────────

  @Post('product-categories')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'create' })
  createCategory(@Body() dto: CreateProductCategoryDto) {
    return this.inventoryService.createCategory(dto);
  }

  @Get('product-categories')
  @Permissions({ module: 'inventory', action: 'view' })
  findAllCategories(@Query('organization_id') organizationId?: string) {
    return this.inventoryService.findAllCategories(organizationId);
  }

  @Patch('product-categories/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.inventoryService.updateCategory(id, dto);
  }

  // ── Products ──────────────────────────────────────────────────

  @Post('products')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'create' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(dto);
  }

  @Get('products')
  @Permissions({ module: 'inventory', action: 'view' })
  findAllProducts(
    @Query('branch_id') branchId?: string,
    @Query('organization_id') organizationId?: string,
    @Query('category_id') categoryId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.findAllProducts({
      branch_id: branchId,
      organization_id: organizationId,
      category_id: categoryId,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('products/barcode/:barcode')
  @Permissions({ module: 'inventory', action: 'view' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.inventoryService.findByBarcode(barcode);
  }

  @Get('products/sku/:sku')
  @Permissions({ module: 'inventory', action: 'view' })
  findBySku(@Param('sku') sku: string) {
    return this.inventoryService.findBySku(sku);
  }

  @Get('products/:id')
  @Permissions({ module: 'inventory', action: 'view' })
  findOneProduct(@Param('id') id: string) {
    return this.inventoryService.findOneProduct(id);
  }

  @Patch('products/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.inventoryService.updateProduct(id, dto);
  }

  // ── Inventory ─────────────────────────────────────────────────

  @Get('inventory')
  @Permissions({ module: 'inventory', action: 'view' })
  getInventory(
    @Query('branch_id') branchId?: string,
    @Query('low_stock') lowStock?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getInventory({
      branch_id: branchId,
      low_stock: lowStock === 'true',
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('inventory/adjust')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  adjustInventory(@Body() dto: AdjustInventoryDto) {
    return this.inventoryService.adjustInventory(dto);
  }

  @Patch('inventory/:productId/reorder-level')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  updateReorderLevel(@Param('productId') productId: string, @Body() dto: UpdateReorderLevelDto) {
    return this.inventoryService.updateReorderLevel(productId, dto);
  }

  @Get('inventory/transactions')
  @Permissions({ module: 'inventory', action: 'view' })
  getTransactions(
    @Query('product_id') productId?: string,
    @Query('branch_id') branchId?: string,
    @Query('transaction_type') transactionType?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryService.getInventoryTransactions({
      product_id: productId,
      branch_id: branchId,
      transaction_type: transactionType,
      start_date: startDate,
      end_date: endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('inventory/low-stock')
  @Permissions({ module: 'inventory', action: 'view' })
  getLowStockAlerts(@Query('branch_id') branchId?: string) {
    return this.inventoryService.getLowStockAlerts(branchId);
  }
}
