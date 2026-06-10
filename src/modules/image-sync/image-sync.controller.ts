import { Controller, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ImageSyncService } from './image-sync.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('v1/:storeSlug/image-sync')
export class ImageSyncController {
  constructor(private readonly imageSyncService: ImageSyncService) {}

  @Post('run')
  run(
    @Param('storeSlug') storeSlug: string,
    @Query('allowCreate') allowCreate?: string,
  ) {
    return this.imageSyncService.syncFromFolder(storeSlug, {
      allowCreate: allowCreate !== 'false',
    });
  }
}
