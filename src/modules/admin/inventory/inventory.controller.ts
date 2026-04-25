import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';

class UpdateInventoryDto {
  status: 'available' | 'on_request' | 'rare';
  stock?: number | null;
}

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
