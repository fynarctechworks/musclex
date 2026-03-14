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
import { ExpensesService, ExpenseCategory } from './expenses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/v1/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(
    @Body()
    body: {
      branch_id: string;
      category: ExpenseCategory;
      description: string;
      amount: number;
      expense_date: string;
      receipt_url?: string;
      recorded_by_staff_id: string;
    },
  ) {
    return this.expensesService.create(body);
  }

  @Get()
  findAll(
    @Query('branch_id') branch_id?: string,
    @Query('category') category?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.expensesService.findAll({
      branch_id,
      category,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      category?: ExpenseCategory;
      description?: string;
      amount?: number;
      expense_date?: string;
      receipt_url?: string;
    },
  ) {
    return this.expensesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
