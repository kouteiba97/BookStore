import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { AdminHomeSectionsService } from './home-sections.service';
import {
  CreateHomeSectionDto,
  ReorderHomeSectionsDto,
  SetShelfBooksDto,
  UpdateHomeSectionDto,
} from './dto/home-section.dto';

/** The storefront home page layout: built-in blocks and hand-picked shelves. */
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/home-sections')
export class AdminHomeSectionsController {
  constructor(private readonly service: AdminHomeSectionsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateHomeSectionDto) {
    return this.service.create(dto);
  }

  @Put('order')
  reorder(@Body() dto: ReorderHomeSectionsDto) {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHomeSectionDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/books')
  setBooks(@Param('id') id: string, @Body() dto: SetShelfBooksDto) {
    return this.service.setBooks(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
