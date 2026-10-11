import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { optionalDate, optionalEnum, paging } from '../../../common/validation/query';
import { RequiresFeature } from '../../../common/plan/requires-feature';
import { EXPENSE_CATEGORIES, ExpenseDto, PaymentDto, PurchaseDto, StoreProfileDto, SupplierDto } from './money.dto';
import { MoneyService } from './money.service';

/** Suppliers, purchases and expenses (pack feature "money"). */
@RequiresFeature('money')
@UseGuards(AdminAuthGuard)
@Controller('v1/admin')
export class MoneyController {
  constructor(private readonly service: MoneyService) {}

  // Suppliers
  @Get('suppliers') suppliers() { return this.service.suppliers(); }
  @Post('suppliers') createSupplier(@Body() dto: SupplierDto) { return this.service.createSupplier(dto); }
  @Put('suppliers/:id') updateSupplier(@Param('id') id: string, @Body() dto: SupplierDto) { return this.service.updateSupplier(id, dto); }
  @Delete('suppliers/:id') deleteSupplier(@Param('id') id: string) { return this.service.deleteSupplier(id); }

  // Purchases
  @Get('purchases')
  purchases(
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.purchases({ supplierId: supplierId || undefined, from: optionalDate(from, false), to: optionalDate(to, true), ...paging(page, pageSize) });
  }
  @Get('purchases/:id') purchase(@Param('id') id: string) { return this.service.purchase(id); }
  @Post('purchases') createPurchase(@Body() dto: PurchaseDto) { return this.service.createPurchase(dto); }
  @Patch('purchases/:id/payment') pay(@Param('id') id: string, @Body() dto: PaymentDto) { return this.service.updatePayment(id, dto.paidAmount); }
  @Post('purchases/:id/cancel') cancel(@Param('id') id: string) { return this.service.cancelPurchase(id); }
  @Delete('purchases/:id') deletePurchase(@Param('id') id: string) { return this.service.deletePurchase(id); }

  // Expenses
  @Get('expenses')
  expenses(
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.expenses({
      category: optionalEnum(category, EXPENSE_CATEGORIES, 'category'),
      from: optionalDate(from, false),
      to: optionalDate(to, true),
      ...paging(page, pageSize),
    });
  }
  @Post('expenses') createExpense(@Body() dto: ExpenseDto) { return this.service.createExpense(dto); }
  @Put('expenses/:id') updateExpense(@Param('id') id: string, @Body() dto: ExpenseDto) { return this.service.updateExpense(id, dto); }
  @Delete('expenses/:id') deleteExpense(@Param('id') id: string) { return this.service.deleteExpense(id); }
}

/** Store profile (invoice header) and the stock log — available on every pack. */
@UseGuards(AdminAuthGuard)
@Controller('v1/admin')
export class StoreSettingsController {
  constructor(private readonly service: MoneyService) {}

  @Get('store-profile') profile() { return this.service.profile(); }
  @Put('store-profile') update(@Body() dto: StoreProfileDto) { return this.service.updateProfile(dto); }
  @Get('stock-movements/:bookId') movements(@Param('bookId') bookId: string) { return this.service.stockMovements(bookId); }
}
