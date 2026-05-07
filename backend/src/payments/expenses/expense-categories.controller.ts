import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ExpenseCategoriesService } from './expense-categories.service';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Controller('api/v1/expense-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @Get()
  @Permissions({ module: 'payments', action: 'view' })
  list(
    @Query('branch_id') branch_id?: string,
    @Query('include_inactive') include_inactive?: string,
  ) {
    return this.service.listCategories({
      branch_id,
      include_inactive: include_inactive === 'true',
    });
  }

  @Post()
  @Permissions({ module: 'payments', action: 'create' })
  create(@Body() body: CreateCategoryDto) {
    return this.service.createCategory(body);
  }

  @Patch(':id')
  @Permissions({ module: 'payments', action: 'edit' })
  update(@Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.service.updateCategory(id, body);
  }

  @Delete(':id')
  @Permissions({ module: 'payments', action: 'edit' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivateCategory(id);
  }
}
