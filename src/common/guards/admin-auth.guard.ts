import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/**
 * Guards admin/operational endpoints. Expects "Authorization: Bearer <jwt>"
 * issued by POST /api/v1/admin/auth/login. Fails closed: no/invalid token
 * → 401. JwtService is provided globally by AuthModule.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

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
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }
}
