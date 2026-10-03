import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CleanService } from './clean.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('v1/:storeSlug/clean')
export class CleanController {
  constructor(private readonly cleanService: CleanService) {}

  @Post('run')
  run(@Param('storeSlug') storeSlug: string) {
    return this.cleanService.cleanDatabase(storeSlug);
  }
}
