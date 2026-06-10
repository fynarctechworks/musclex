import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { AdminRole, ErrorSeverity } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AlertService } from '../services/alert.service';

class AlertFilterDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  acknowledged?: boolean;

  @IsOptional()
  @IsEnum(ErrorSeverity)
  severity?: ErrorSeverity;
}

@ApiTags('System Alerts')
@ApiBearerAuth()
@Controller('system-alerts')
export class SystemAlertsController {
  constructor(private readonly alerts: AlertService) {}

  @Get()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT, AdminRole.BILLING)
  @ApiOperation({ summary: 'List system alerts (filter by acknowledged / severity)' })
  findAll(@Query() query: AlertFilterDto) {
    return this.alerts.findAll(query, {
      acknowledged: query.acknowledged,
      severity: query.severity,
    });
  }

  @Patch(':id/ack')
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin('id') adminId: string,
  ) {
    return this.alerts.acknowledge(id, adminId);
  }
}
