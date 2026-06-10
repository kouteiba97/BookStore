import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ImagesService } from './images.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('v1/:storeSlug/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('fill')
  fill(@Param('storeSlug') storeSlug: string) {
    return this.imagesService.fillMissingImages(storeSlug);
  }
}
