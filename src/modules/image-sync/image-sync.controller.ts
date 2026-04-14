import { Controller, Post, Param } from '@nestjs/common';
import { ImageSyncService } from './image-sync.service';

@Controller('v1/:storeSlug/image-sync')
export class ImageSyncController {
  constructor(private readonly imageSyncService: ImageSyncService) {}

  @Post('run')
  run(@Param('storeSlug') storeSlug: string) {
    return this.imageSyncService.syncFromFolder(storeSlug);
  }
}
