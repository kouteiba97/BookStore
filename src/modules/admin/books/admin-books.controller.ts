import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminBooksService } from './admin-books.service';
import { UpsertBookDto } from './dto/upsert-book.dto';

@Controller('v1/admin/books')
export class AdminBooksController {
  constructor(private readonly service: AdminBooksService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('inventoryStatus') inventoryStatus?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      search,
      categoryId,
      inventoryStatus,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
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
