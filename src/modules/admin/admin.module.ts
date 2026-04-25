import { Module } from '@nestjs/common';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { AdminBooksController } from './books/admin-books.controller';
import { AdminBooksService } from './books/admin-books.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { AdminAcademicController } from './academic/admin-academic.controller';
import { AdminAcademicService } from './academic/admin-academic.service';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { StoreResolver } from './store-resolver.service';

@Module({
  controllers: [
    StatsController,
    AdminBooksController,
    CatalogController,
    AdminAcademicController,
    OrdersController,
    InventoryController,
  ],
  providers: [
    StoreResolver,
    StatsService,
    AdminBooksService,
    CatalogService,
    AdminAcademicService,
    OrdersService,
    InventoryService,
  ],
})
export class AdminModule {}
