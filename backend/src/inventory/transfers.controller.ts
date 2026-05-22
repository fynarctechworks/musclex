import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransferService } from './transfer.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  CreateTransferDto,
  ReceiveTransferDto,
  UpsertBranchPriceDto,
} from './dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TransfersController {
  constructor(private readonly transferService: TransferService) {}

  // ── Stock transfers ───────────────────────────────────────────

  @Post('transfers')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'create' })
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.transferService.createTransfer(dto);
  }

  @Get('transfers')
  @Permissions({ module: 'inventory', action: 'view' })
  findAll(
    @Query('from_branch_id') fromBranchId?: string,
    @Query('to_branch_id') toBranchId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transferService.findAll({
      from_branch_id: fromBranchId,
      to_branch_id: toBranchId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('transfers/:id')
  @Permissions({ module: 'inventory', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Patch('transfers/:id/receive')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  receive(@Param('id') id: string, @Body() dto: ReceiveTransferDto) {
    return this.transferService.receiveTransfer(id, dto);
  }

  @Patch('transfers/:id/cancel')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  cancel(@Param('id') id: string) {
    return this.transferService.cancelTransfer(id);
  }

  // ── Per-branch pricing ────────────────────────────────────────

  @Post('branch-prices')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  upsertBranchPrice(@Body() dto: UpsertBranchPriceDto) {
    return this.transferService.upsertBranchPrice(dto);
  }

  @Get('products/:productId/branch-prices')
  @Permissions({ module: 'inventory', action: 'view' })
  getBranchPrices(@Param('productId') productId: string) {
    return this.transferService.getBranchPrices(productId);
  }

  @Delete('products/:productId/branch-prices/:branchId')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  deleteBranchPrice(
    @Param('productId') productId: string,
    @Param('branchId') branchId: string,
  ) {
    return this.transferService.deleteBranchPrice(productId, branchId);
  }
}
