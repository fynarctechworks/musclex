import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditAction } from '@prisma/client';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';

class AuditLogFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsString()
  entity_id?: string;

  @IsOptional()
  @IsString()
  admin_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs with filters' })
  findAll(@Query() query: AuditLogFilterDto) {
    return this.auditLogsService.findAll(query, {
      action: query.action,
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      admin_id: query.admin_id,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
