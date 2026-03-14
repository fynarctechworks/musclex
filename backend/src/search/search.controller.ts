import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SearchService, GlobalSearchResponse } from './search.service';
import { JwtAuthGuard, RolesGuard, Roles } from '../common';

@Controller('api/v1/search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Roles('owner', 'admin', 'manager', 'front_desk', 'trainer')
  async globalSearch(
    @Query('q') query: string,
    @Query('entities') entities?: string,
    @Query('limit') limit?: string,
    @Query('branch_id') branchId?: string,
  ): Promise<GlobalSearchResponse> {
    return this.searchService.globalSearch(query || '', {
      entities: entities ? entities.split(',') : undefined,
      limit: limit ? parseInt(limit, 10) : 20,
      branchId,
    });
  }

  @Post('reindex/:indexName')
  @Roles('owner', 'admin')
  async reindex(
    @Param('indexName') indexName: string,
  ): Promise<{ indexed: number }> {
    return this.searchService.reindexAll(indexName);
  }
}
