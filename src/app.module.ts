import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './modules/books/books.module';
import { RequestsModule } from './modules/requests/requests.module';
import { AcademicModule } from './modules/academic/academic.module';
import { ImportModule } from './modules/import/import.module';
import { ImagesModule } from './modules/images/images.module';
import { CleanModule } from './modules/clean/clean.module';
import { ImageSyncModule } from './modules/image-sync/image-sync.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    BooksModule,
    RequestsModule,
    AcademicModule,
    ImportModule,
    ImagesModule,
    CleanModule,
    ImageSyncModule,
    AdminModule,
  ],
})
export class AppModule {}
