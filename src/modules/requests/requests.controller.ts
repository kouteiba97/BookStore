import { Body, Controller, Param, Post } from '@nestjs/common';
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
}
