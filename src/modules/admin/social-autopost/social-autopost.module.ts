import { Module } from '@nestjs/common';
import { SocialAutopostService } from './autopost.service';
import { SocialNotifier } from './notifier.service';

/**
 * The auto-posting engine on its own, without HTTP — used both by the admin
 * module and by the cron entry point (src/social-tick.ts), which needs only
 * the database, storage and this.
 */
@Module({
  providers: [SocialAutopostService, SocialNotifier],
  exports: [SocialAutopostService, SocialNotifier],
})
export class SocialAutopostEngineModule {}
