import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './modules/books/books.module';
import { RequestsModule } from './modules/requests/requests.module';
import { AcademicModule } from './modules/academic/academic.module';
import { ImportModule } from './modules/import/import.module';
import { ImagesModule } from './modules/images/images.module';
import { CleanModule } from './modules/clean/clean.module';

@Module({
  imports: [PrismaModule, BooksModule, RequestsModule, AcademicModule, ImportModule, ImagesModule, CleanModule],
})
export class AppModule {}
