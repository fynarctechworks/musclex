import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';
import { Public } from '../../../common/decorators/public.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentAdmin } from '../../../common/decorators/current-admin.decorator';
import { IngestKeyGuard } from '../guards/ingest-key.guard';
import { ErrorIngestService } from '../services/error-ingest.service';
import { ErrorQueryService } from '../services/error-query.service';
import {
  IngestErrorBatchDto,
  QueryErrorsDto,
  UpdateErrorDto,
  BulkResolveDto,
} from '../dto';

@ApiTags('System Errors')
@Controller('system-errors')
export class SystemErrorsController {
  constructor(
    private readonly ingest: ErrorIngestService,
    private readonly query: ErrorQueryService,
  ) {}

  /**
   * Public ingestion endpoint for client gym apps + the SCC itself.
   * Auth is the `x-ingest-key` header, not the admin JWT. Throttled generously
   * to absorb bursts from many gyms while still capping abuse per source IP.
   */
  @Post()
  @Public()
  @UseGuards(IngestKeyGuard)
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @ApiSecurity('ingest-key')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingest one or more error events (x-ingest-key auth)' })
  ingestErrors(@Body() body: IngestErrorBatchDto, @Ip() ip: string) {
    return this.ingest.ingestBatch(body.events, { ipAddress: ip });
  }

  @Get()
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT, AdminRole.BILLING)
  @ApiOperation({ summary: 'List grouped errors with filters + pagination' })
  findAll(@Query() query: QueryErrorsDto) {
    return this.query.findAll(query);
  }

  @Get('stats')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT, AdminRole.BILLING)
  @ApiOperation({ summary: 'Dashboard cards, severity breakdown, and 14-day trend' })
  stats() {
    return this.query.stats();
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT, AdminRole.BILLING)
  @ApiOperation({ summary: 'Error detail with recent occurrences + activity timeline' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.query.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Update status / severity / assignment / resolution note' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateErrorDto,
    @CurrentAdmin('id') adminId: string,
  ) {
    return this.query.update(id, dto, adminId);
  }

  @Post('bulk-resolve')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Resolve multiple error groups at once' })
  bulkResolve(@Body() dto: BulkResolveDto, @CurrentAdmin('id') adminId: string) {
    return this.query.bulkResolve(dto, adminId);
  }
}
