import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('v1/admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    const range = Number(days) > 0 ? Number(days) : 30;
    return this.statsService.overview(range);
  }
}
