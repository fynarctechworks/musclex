import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  TopUpWalletDto,
  AdjustWalletDto,
  UpsertLoyaltyConfigDto,
} from './dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ── Member wallet ─────────────────────────────────────────────

  @Get('members/:memberId/wallet')
  @Permissions({ module: 'members', action: 'view' })
  getWallet(@Param('memberId') memberId: string) {
    return this.walletService.getWallet(memberId);
  }

  @Get('members/:memberId/wallet/transactions')
  @Permissions({ module: 'members', action: 'view' })
  getTransactions(
    @Param('memberId') memberId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.walletService.getTransactions(
      memberId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('wallet/topup')
  @Roles('owner', 'brand_owner', 'manager', 'branch_manager', 'front_desk', 'accountant')
  @Permissions({ module: 'payments', action: 'create' })
  topUp(@Body() dto: TopUpWalletDto) {
    return this.walletService.topUp(dto);
  }

  @Post('wallet/adjust')
  @Roles('owner', 'brand_owner', 'manager', 'branch_manager')
  @Permissions({ module: 'payments', action: 'edit' })
  adjust(@Body() dto: AdjustWalletDto) {
    return this.walletService.adjust(dto);
  }

  // ── Loyalty config ────────────────────────────────────────────

  @Get('loyalty/config')
  @Permissions({ module: 'settings', action: 'view' })
  getConfig() {
    return this.walletService.getConfig();
  }

  @Put('loyalty/config')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'settings', action: 'edit' })
  upsertConfig(@Body() dto: UpsertLoyaltyConfigDto) {
    return this.walletService.upsertConfig(dto);
  }
}
