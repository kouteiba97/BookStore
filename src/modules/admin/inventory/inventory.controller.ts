import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';

class UpdateInventoryDto {
  status: 'available' | 'on_request' | 'rare';
  stock?: number | null;
}

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.service.list({
      search,
      status,
      lowStock: lowStock === 'true',
    });
  }

  @Patch(':bookId')
  update(@Param('bookId') bookId: string, @Body() dto: UpdateInventoryDto) {
    return this.service.upsert(bookId, dto);
  }
}
