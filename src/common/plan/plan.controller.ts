import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { PlanService } from './plan.service';

/** The store's pack: features, limits and current usage (drives the admin's locks). */
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/plan')
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  @Get()
  current() {
    return this.plans.current();
  }
}
