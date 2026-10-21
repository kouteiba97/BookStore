import { Controller, Get, Param, Query } from '@nestjs/common';
import { BooksService } from './books.service';
import { HomeSectionsService } from './home-sections.service';

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
  findAll(
    @Param('storeSlug') storeSlug: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.booksService.findAll(storeSlug, Number(limit) || undefined, categoryId?.slice(0, 64) || undefined);
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

/** The home page layout the admin arranges, and the «عرض الكل» page of a shelf. */
@Controller('v1/:storeSlug/home-sections')
export class HomeSectionsController {
  constructor(private readonly sections: HomeSectionsService) {}

  @Get()
  list(@Param('storeSlug') storeSlug: string) {
    return this.sections.list(storeSlug);
  }

  @Get(':id')
  shelf(@Param('storeSlug') storeSlug: string, @Param('id') id: string) {
    return this.sections.shelf(storeSlug, id.slice(0, 64));
  }
}

/** Categories this store has books in — what the storefront offers to browse. */
@Controller('v1/:storeSlug/categories')
export class StoreCategoriesController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  list(@Param('storeSlug') storeSlug: string) {
    return this.booksService.categories(storeSlug);
  }
}
