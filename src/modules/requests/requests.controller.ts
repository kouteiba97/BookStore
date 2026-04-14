import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Controller('v1/:storeSlug/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: CreateRequestDto,
  ) {
    return this.requestsService.create(storeSlug, dto);
  }

  @Get()
  findAll(
    @Param('storeSlug') storeSlug: string,
    @Query('status') status?: string,
    @Query('wilaya') wilaya?: string,
    @Query('search') search?: string,
  ) {
    return this.requestsService.findAll(storeSlug, { status, wilaya, search });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('storeSlug') storeSlug: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.requestsService.updateStatus(storeSlug, id, status);
  }
}
