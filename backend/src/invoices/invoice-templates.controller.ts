import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, PermissionsGuard } from '../common';
import { INVOICE_TEMPLATES, DEFAULT_TEMPLATE_ID } from './invoice-templates';

@Controller('api/v1/invoice-templates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InvoiceTemplatesController {
  @Get()
  getTemplates() {
    return {
      templates: INVOICE_TEMPLATES,
      default_template_id: DEFAULT_TEMPLATE_ID,
    };
  }
}
