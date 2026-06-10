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
  UpdateOrderStatusDto,
  UpsertOrderDto,
} from './dto/order.dto';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      status,
      search,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
    });
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
