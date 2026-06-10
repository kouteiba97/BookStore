import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    const range = Number(days) > 0 ? Number(days) : 30;
    return this.statsService.overview(range);
  }
}
