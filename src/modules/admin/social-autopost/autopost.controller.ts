import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { RequiresFeature } from '../../../common/plan/requires-feature';
import { SocialAutopostAdminService } from './autopost-admin.service';
import { CalendarDto, ChannelDto, ConnectDto, SettingsDto, UpdatePostDto } from './autopost.dto';
import { PLATFORMS } from './autopost.service';
import type { Platform } from './schedule';

/** Automatic posting to Facebook and Instagram — the owner's controls. */
@RequiresFeature('socialExport')
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/social-autopost')
export class SocialAutopostController {
  constructor(private readonly service: SocialAutopostAdminService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Put('connection')
  connect(@Body() dto: ConnectDto) {
    return this.service.connect(dto.token, dto.pageId);
  }

  @Delete('connection')
  disconnect() {
    return this.service.disconnect();
  }

  @Patch('channels/:platform')
  channel(@Param('platform') platform: string, @Body() dto: ChannelDto) {
    if (!(PLATFORMS as string[]).includes(platform)) throw new BadRequestException('Unknown platform');
    return this.service.updateChannel(platform as Platform, dto);
  }

  @Patch('settings')
  settings(@Body() dto: SettingsDto) {
    return this.service.updateSettings(dto.autoApproveHours);
  }

  @Put('calendar')
  calendar(@Body() dto: CalendarDto) {
    return this.service.updateCalendar(dto.calendar);
  }

  @Get('posts')
  posts() {
    return this.service.listPosts();
  }

  @Patch('posts/:id')
  updatePost(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.service.updatePost(id.slice(0, 64), dto);
  }

  /** Run the job now instead of waiting for the next scheduled run. */
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('run')
  run() {
    return this.service.runNow();
  }
}
