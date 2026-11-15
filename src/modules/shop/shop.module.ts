import { Module } from '@nestjs/common';
import { ShopOrdersController } from './shop-orders.controller';
import { ShopOrdersService } from './shop-orders.service';
import { AccountController } from './account/account.controller';
import { AccountService } from './account/account.service';
import { CustomerTokens } from '../../common/auth/customer-tokens';

/** Customer-facing storefront actions: checkout, tracking, optional accounts. */
@Module({
  controllers: [ShopOrdersController, AccountController],
  providers: [ShopOrdersService, AccountService, CustomerTokens],
})
export class ShopModule {}
