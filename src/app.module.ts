import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AuthModule } from './modules/admin/auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit (per IP). Endpoint-specific limits via @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule,
    StorageModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    // AdminModule first: its literal routes (v1/admin/books) must register
    // before the public wildcard routes (v1/:storeSlug/books), otherwise
    // ":storeSlug" swallows "admin" and admin GETs 404 with "Store not found".
    AdminModule,
    BooksModule,
    RequestsModule,
    AcademicModule,
    ImportModule,
    ImagesModule,
    CleanModule,
    ImageSyncModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
