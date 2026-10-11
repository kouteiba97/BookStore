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
import { OrdersService } from './orders.service';
import {
  ConvertRequestDto,
  CounterSaleDto,
  SALE_CHANNELS,
  UpdateOrderStatusDto,
  UpsertOrderDto,
} from './dto/order.dto';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { RequiresFeature } from '../../../common/plan/requires-feature';
import { ORDER_STATUSES, optionalDate, optionalEnum, paging } from '../../../common/validation/query';

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      status: optionalEnum(status, ORDER_STATUSES, 'status'),
      channel: optionalEnum(channel, SALE_CHANNELS, 'channel'),
      from: optionalDate(from, false),
      to: optionalDate(to, true),
      search,
      ...paging(page, pageSize),
    });
  }

  /** A sale at the counter — paid now, books leave stock now. */
  @Post('counter')
  counter(@Body() dto: CounterSaleDto) {
    return this.service.counterSale(dto);
  }

  /** Invoice data (numbers the invoice the first time). */
  @RequiresFeature('invoices')
  @Post(':id/invoice')
  invoice(@Param('id') id: string) {
    return this.service.invoice(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: UpsertOrderDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertOrderDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.updateStatus(id, 'cancelled');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Convert a Request (lead) into an Order
  @Post('from-request/:requestId')
  convertFromRequest(
    @Param('requestId') requestId: string,
    @Body() dto: ConvertRequestDto,
  ) {
    return this.service.convertFromRequest(requestId, dto);
  }
}
