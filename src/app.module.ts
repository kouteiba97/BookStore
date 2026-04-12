import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './modules/books/books.module';
import { RequestsModule } from './modules/requests/requests.module';
import { AcademicModule } from './modules/academic/academic.module';

@Module({
  imports: [PrismaModule, BooksModule, RequestsModule, AcademicModule],
})
export class AppModule {}
