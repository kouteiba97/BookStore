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
import { AdminBooksService } from './admin-books.service';
import { UpsertBookDto } from './dto/upsert-book.dto';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import {
  INVENTORY_STATUSES,
  optionalEnum,
  paging,
} from '../../../common/validation/query';

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/books')
export class AdminBooksController {
  constructor(private readonly service: AdminBooksService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('inventoryStatus') inventoryStatus?: string,
    @Query('missing') missing?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      search,
      categoryId,
      inventoryStatus: optionalEnum(inventoryStatus, INVENTORY_STATUSES, 'inventoryStatus'),
      missing: optionalEnum(missing, ['price', 'cover', 'author', 'category', 'stock', 'outOfStock'] as const, 'missing'),
      ...paging(page, pageSize),
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: UpsertBookDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertBookDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
