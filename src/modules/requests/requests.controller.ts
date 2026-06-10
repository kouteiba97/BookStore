import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Controller('v1/:storeSlug/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // Public: customers submit book-request leads. Throttled hard — it's the
  // only unauthenticated write endpoint.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: CreateRequestDto,
  ) {
    return this.requestsService.create(storeSlug, dto);
  }

  // Admin-only: lists customer PII (names, phones, addresses).
  @UseGuards(AdminAuthGuard)
  @Get()
  findAll(
    @Param('storeSlug') storeSlug: string,
    @Query('status') status?: string,
    @Query('wilaya') wilaya?: string,
    @Query('search') search?: string,
  ) {
    return this.requestsService.findAll(storeSlug, { status, wilaya, search });
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('storeSlug') storeSlug: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.requestsService.updateStatus(storeSlug, id, status);
  }
}
