import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FamilyMembershipService } from './family-membership.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateFamilyMembershipDto, AddFamilyMemberDto } from './dto';

@Controller('api/v1/family-memberships')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FamilyController {
  constructor(private readonly familyService: FamilyMembershipService) {}

  @Post()
  @Roles('owner', 'branch_manager')
  create(@Body() dto: CreateFamilyMembershipDto) {
    return this.familyService.create(dto);
  }

  @Get(':id')
  @Roles('owner', 'branch_manager', 'front_desk', 'trainer')
  findOne(@Param('id') id: string) {
    return this.familyService.findOne(id);
  }

  @Get('member/:memberId')
  @Roles('owner', 'branch_manager', 'front_desk', 'trainer')
  findByMember(@Param('memberId') memberId: string) {
    return this.familyService.findByMember(memberId);
  }

  @Post(':id/members')
  @Roles('owner', 'branch_manager', 'front_desk')
  addMember(@Param('id') id: string, @Body() dto: AddFamilyMemberDto) {
    return this.familyService.addMember(id, dto);
  }

  @Delete(':id/members/:memberId')
  @Roles('owner', 'branch_manager')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.familyService.removeMember(id, memberId);
  }
}
