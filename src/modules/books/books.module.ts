import { Module } from '@nestjs/common';
import { BooksController, StoreCategoriesController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  controllers: [BooksController, StoreCategoriesController],
  providers: [BooksService],
})
export class BooksModule {}
