import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { paging } from '../../../common/validation/query';
import { CustomersService } from './customers.service';

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  list(@Query('search') search?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.list({ search, ...paging(page, pageSize) });
  }

  /** One-time "set a new password" link, to send the customer on WhatsApp. */
  @Post(':id/reset-link')
  resetLink(@Param('id') id: string) {
    return this.service.resetLink(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
