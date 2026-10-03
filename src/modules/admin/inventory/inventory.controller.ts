import { Body, Controller, Get, Param, Patch, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { InventoryService } from './inventory.service';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { INVENTORY_STATUSES, optionalEnum } from '../../../common/validation/query';

// Validators are required, not decoration: the global ValidationPipe runs
// with `whitelist`, which strips every undecorated property. Without them the
// body arrived empty and every stock edit failed.
class UpdateInventoryDto {
  @IsIn(INVENTORY_STATUSES)
  status: (typeof INVENTORY_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number | null;
}

/** Rows returned when the caller does not ask for a limit. */
const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  /**
   * Still a plain array (the web and mobile stock screens both read one), but
   * bounded: the total is in `X-Total-Count`, so a client can tell the list
   * was cut and ask the user to search.
   */
  @Get()
  async list(
    @Res({ passthrough: true }) res: Response,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('lowStock') lowStock?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(limit)) || DEFAULT_LIMIT));
    const { books, total } = await this.service.list({
      search,
      status: optionalEnum(status, INVENTORY_STATUSES, 'status'),
      lowStock: lowStock === 'true',
      take,
    });
    res.setHeader('X-Total-Count', String(total));
    return books;
  }

  @Patch(':bookId')
  update(@Param('bookId') bookId: string, @Body() dto: UpdateInventoryDto) {
    return this.service.upsert(bookId, dto);
  }
}
