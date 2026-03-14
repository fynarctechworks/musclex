import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../common';

@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findRecent(@Query('limit') limit?: string) {
    return this.auditService.findRecent(limit ? parseInt(limit, 10) : 100);
  }

  @Get('by-module')
  findByModule(
    @Query('module') module: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findByModule(
      module,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('by-user')
  findByUser(
    @Query('user_id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findByUser(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
