import { Module } from '@nestjs/common';
import { ImageSyncController } from './image-sync.controller';
import { ImageSyncService } from './image-sync.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ImageSyncController],
  providers: [ImageSyncService],
})
export class ImageSyncModule {}
