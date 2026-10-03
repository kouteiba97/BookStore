import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { StoreResolver } from '../tenant/store-resolver.service';

/**
 * Guards admin/operational endpoints. Expects "Authorization: Bearer <jwt>"
 * issued by POST /api/v1/admin/auth/login. Fails closed: no/invalid token
 * → 401. JwtService is provided globally by AuthModule.
 *
 * Tenancy: an admin token belongs to the store this deployment serves. Routes
 * that name a store in the URL (`/v1/:storeSlug/import`, `/requests`, …) are
 * refused for any other store, so a valid token can never reach another
 * store's data by editing the slug.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly stores: StoreResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing admin token');
    }

    try {
      const payload = await this.jwt.verifyAsync<{ role?: string }>(token);
      if (payload.role !== 'admin') throw new Error('not admin');
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    const slug = req.params?.storeSlug;
    if (slug !== undefined) {
      const own = await this.stores.getStore();
      if (slug !== own.slug) {
        throw new ForbiddenException('This admin account cannot access that store');
      }
    }
    return true;
  }
}
