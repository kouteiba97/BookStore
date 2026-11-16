import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountService } from './account.service';
import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './account.dto';
import { CurrentCustomer, CustomerAuthGuard, type AuthedCustomer } from '../../../common/guards/customer-auth.guard';

/** Optional customer accounts: v1/:storeSlug/account/… */
@Controller('v1/:storeSlug/account')
export class AccountController {
  constructor(private readonly service: AccountService) {}

  // Slow down password guessing and mass sign-ups.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Param('storeSlug') storeSlug: string, @Body() dto: RegisterDto) {
    return this.service.register(storeSlug, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Param('storeSlug') storeSlug: string, @Body() dto: LoginDto) {
    return this.service.login(storeSlug, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset')
  reset(@Param('storeSlug') storeSlug: string, @Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(storeSlug, dto);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('me')
  me(@CurrentCustomer() c: AuthedCustomer) {
    return this.service.me(c.id);
  }

  @UseGuards(CustomerAuthGuard)
  @Patch('me')
  update(@CurrentCustomer() c: AuthedCustomer, @Body() dto: UpdateProfileDto) {
    return this.service.update(c.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(CustomerAuthGuard)
  @Post('password')
  changePassword(@CurrentCustomer() c: AuthedCustomer, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(c.id, dto);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('orders')
  orders(@CurrentCustomer() c: AuthedCustomer) {
    return this.service.orders(c.id);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('orders/:reference')
  order(@CurrentCustomer() c: AuthedCustomer, @Param('reference') reference: string) {
    return this.service.order(c.id, reference);
  }
}
