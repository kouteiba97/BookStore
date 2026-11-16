import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ShopOrdersService } from './shop-orders.service';
import { CreateShopOrderDto, QuoteDto } from './dto/shop-order.dto';
import { CurrentCustomer, OptionalCustomerGuard, type AuthedCustomer } from '../../common/guards/customer-auth.guard';

/**
 * Public storefront orders: place one, follow one, re-price a basket.
 * Registered after AdminModule so `v1/admin/orders` keeps going to the admin.
 */
@Controller('v1/:storeSlug/orders')
export class ShopOrdersController {
  constructor(private readonly service: ShopOrdersService) {}

  // The storefront's main write: throttled like the old request form.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  // A logged-in customer's order joins their account; guests are welcome.
  @UseGuards(OptionalCustomerGuard)
  @Post()
  create(
    @Param('storeSlug') storeSlug: string,
    @Body() dto: CreateShopOrderDto,
    @CurrentCustomer() customer?: AuthedCustomer,
  ) {
    return this.service.create(storeSlug, dto, customer?.id ?? null);
  }

  // Reference + phone must both match; throttled so neither can be guessed.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('track')
  track(
    @Param('storeSlug') storeSlug: string,
    @Query('ref') ref?: string,
    @Query('phone') phone?: string,
  ) {
    return this.service.track(storeSlug, ref, phone);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('quote')
  @HttpCode(200)
  quote(@Param('storeSlug') storeSlug: string, @Body() dto: QuoteDto) {
    return this.service.quote(storeSlug, dto.bookIds);
  }
}
