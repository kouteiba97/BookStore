import { Controller, Post, Param } from '@nestjs/common';
import { ImagesService } from './images.service';

@Controller('v1/:storeSlug/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('fill')
  fill(@Param('storeSlug') storeSlug: string) {
    return this.imagesService.fillMissingImages(storeSlug);
  }
}
