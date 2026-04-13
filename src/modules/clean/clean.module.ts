import { Module } from '@nestjs/common';
import { CleanController } from './clean.controller';
import { CleanService } from './clean.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CleanController],
  providers: [CleanService],
})
export class CleanModule {}
