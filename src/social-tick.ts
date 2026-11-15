import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './common/tenant/tenant.module';
import { StorageModule } from './modules/storage/storage.module';
import { SocialAutopostEngineModule } from './modules/admin/social-autopost/social-autopost.module';
import { SocialAutopostService } from './modules/admin/social-autopost/autopost.service';

/**
 * One run of the social auto-poster, then exit.
 *
 * Render runs this every 10 minutes as a Cron Job (render.yaml →
 * `node dist/social-tick.js`). It does not need the web service to be awake:
 * on the free plan the API sleeps after 15 idle minutes, so a timer inside it
 * would not fire. Locally: `npm run social:tick`.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, TenantModule, StorageModule, SocialAutopostEngineModule],
})
class SocialTickModule {}

async function main() {
  const logger = new Logger('SocialTick');
  const app = await NestFactory.createApplicationContext(SocialTickModule, { logger: ['log', 'warn', 'error'] });
  let code = 0;
  try {
    const report = await app.get(SocialAutopostService).tick();
    logger.log(JSON.stringify(report));
  } catch (err) {
    logger.error('Run failed', err instanceof Error ? err.stack : String(err));
    code = 1;
  } finally {
    await app.close();
  }
  process.exit(code);
}

main().catch((err) => {
  new Logger('SocialTick').error('Could not start', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
