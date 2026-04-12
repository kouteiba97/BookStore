import { Controller, Get, Param, Query } from '@nestjs/common';
import { BooksService } from './books.service';

@Controller('v1/:storeSlug/books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get('search')
  search(
    @Param('storeSlug') storeSlug: string,
    @Query('q') q: string = '',
  ) {
    return this.booksService.search(storeSlug, q);
  }

  @Get('autocomplete')
  autocomplete(
    @Param('storeSlug') storeSlug: string,
    @Query('q') q: string = '',
  ) {
    return this.booksService.autocomplete(storeSlug, q);
  }

  @Get('suggestions')
  suggestions(
    @Param('storeSlug') storeSlug: string,
    @Query('q') q: string = '',
  ) {
    return this.booksService.suggestions(storeSlug, q);
  }

  @Get()
  findAll(@Param('storeSlug') storeSlug: string) {
    return this.booksService.findAll(storeSlug);
  }

  @Get(':id/recommendations')
  recommendations(
    @Param('storeSlug') storeSlug: string,
    @Param('id') id: string,
  ) {
    return this.booksService.recommendations(storeSlug, id);
  }

  @Get(':id')
  findOne(@Param('storeSlug') storeSlug: string, @Param('id') id: string) {
    return this.booksService.findOne(storeSlug, id);
  }
}
