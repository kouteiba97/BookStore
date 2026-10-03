import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    // Clamped: the range drives a per-day loop and an unbounded query.
    const n = Math.floor(Number(days));
    const range = n > 0 ? Math.min(n, 365) : 30;
    return this.statsService.overview(range);
  }
}
