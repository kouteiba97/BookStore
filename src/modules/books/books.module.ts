import { Module } from '@nestjs/common';
import { BooksController, HomeSectionsController, StoreCategoriesController } from './books.controller';
import { BooksService } from './books.service';
import { HomeSectionsService } from './home-sections.service';

@Module({
  controllers: [BooksController, StoreCategoriesController, HomeSectionsController],
  providers: [BooksService, HomeSectionsService],
})
export class BooksModule {}
