import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [PrismaModule, ImagesModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
