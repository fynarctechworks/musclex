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
import { ClassTemplateService } from './class-template.service';
import { CreateClassTemplateDto, UpdateClassTemplateDto } from './dto';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';

@Controller('api/v1/classes/templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassTemplateController {
  constructor(private readonly templateService: ClassTemplateService) {}

  @Post()
  @Permissions({ module: 'classes', action: 'create' })
  create(@Body() dto: CreateClassTemplateDto) {
    return this.templateService.create(dto);
  }

  @Get()
  @Permissions({ module: 'classes', action: 'view' })
  findAll(
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
    @Query('category') category?: string,
    @Query('is_active') is_active?: string,
  ) {
    return this.templateService.findAll({
      branch_id,
      organization_id,
      category,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    });
  }

  @Get(':id')
  @Permissions({ module: 'classes', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'classes', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateClassTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @Permissions({ module: 'classes', action: 'delete' })
  remove(@Param('id') id: string) {
    return this.templateService.remove(id);
  }
}
