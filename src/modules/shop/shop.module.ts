import { Module } from '@nestjs/common';
import { ShopOrdersController } from './shop-orders.controller';
import { ShopOrdersService } from './shop-orders.service';

/** Customer-facing storefront actions: checkout and order tracking. */
@Module({
  controllers: [ShopOrdersController],
  providers: [ShopOrdersService],
})
export class ShopModule {}
