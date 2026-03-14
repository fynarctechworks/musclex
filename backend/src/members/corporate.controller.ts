import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CorporateMembershipService } from './corporate-membership.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCorporateAccountDto, AddCorporateMemberDto } from './dto';

@Controller('api/v1/corporate')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CorporateController {
  constructor(private readonly corporateService: CorporateMembershipService) {}

  // ── Corporate Accounts ────────────────────────────────────

  @Post('accounts')
  @Roles('owner')
  createAccount(@Body() dto: CreateCorporateAccountDto) {
    return this.corporateService.createAccount(dto);
  }

  @Get('accounts')
  @Roles('owner', 'branch_manager')
  findAllAccounts(
    @Query('organization_id') organization_id?: string,
    @Query('status') status?: string,
  ) {
    return this.corporateService.findAllAccounts({ organization_id, status });
  }

  @Get('accounts/:id')
  findOneAccount(@Param('id') id: string) {
    return this.corporateService.findOneAccount(id);
  }

  @Patch('accounts/:id')
  @Roles('owner')
  updateAccount(
    @Param('id') id: string,
    @Body() data: Partial<CreateCorporateAccountDto> & { status?: string },
  ) {
    return this.corporateService.updateAccount(id, data);
  }

  // ── Corporate Members ─────────────────────────────────────

  @Get('accounts/:id/members')
  getAccountMembers(@Param('id') id: string) {
    return this.corporateService.getAccountMembers(id);
  }

  @Post('accounts/:id/members')
  @Roles('owner', 'branch_manager')
  addMember(@Param('id') id: string, @Body() dto: AddCorporateMemberDto) {
    return this.corporateService.addMember(id, dto);
  }

  @Delete('accounts/:id/members/:memberId')
  @Roles('owner', 'branch_manager')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.corporateService.removeMember(id, memberId);
  }
}
