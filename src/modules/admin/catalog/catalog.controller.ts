import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CatalogService, CatalogResource } from './catalog.service';
import { UpsertCatalogDto } from './dto/upsert-catalog.dto';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';

const allowed: CatalogResource[] = [
  'categories',
  'authors',
  'publishers',
  'countries',
];

function assertResource(resource: string): CatalogResource {
  if (!allowed.includes(resource as CatalogResource)) {
    throw new BadRequestException(`Unknown catalog resource: ${resource}`);
  }
  return resource as CatalogResource;
}

@UseGuards(AdminAuthGuard)
@Controller('v1/admin/catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get(':resource')
  list(@Param('resource') resource: string) {
    return this.service.list(assertResource(resource));
  }

  @Post(':resource')
  create(@Param('resource') resource: string, @Body() dto: UpsertCatalogDto) {
    return this.service.create(assertResource(resource), dto);
  }

  @Patch(':resource/:id')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: UpsertCatalogDto,
  ) {
    return this.service.update(assertResource(resource), id, dto);
  }

  @Delete(':resource/:id')
  remove(@Param('resource') resource: string, @Param('id') id: string) {
    return this.service.remove(assertResource(resource), id);
  }
}
