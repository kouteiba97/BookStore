import { Controller, Post, Param } from '@nestjs/common';
import { CleanService } from './clean.service';

@Controller('v1/:storeSlug/clean')
export class CleanController {
  constructor(private readonly cleanService: CleanService) {}

  @Post('run')
  run() {
    return this.cleanService.cleanDatabase();
  }
}
