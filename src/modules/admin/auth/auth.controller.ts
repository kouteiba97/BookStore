import {
  Body,
  Controller,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { IsNotEmpty, IsString } from 'class-validator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}

/**
 * Shared-password admin login. Compares against ADMIN_PASSWORD (env) and
 * issues a 30-day JWT consumed by AdminAuthGuard. Single back-office user
 * model (the family shares one password); upgrade to per-user accounts later
 * if needed.
 */
@Controller('v1/admin/auth')
export class AuthController {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Tight throttle: slow down password brute-forcing.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const expected = this.config.get<string>('ADMIN_PASSWORD');
    if (!expected) {
      // Fail closed: never allow login when the password isn't configured.
      throw new ServiceUnavailableException(
        'ADMIN_PASSWORD is not configured on the server',
      );
    }

    if (!this.safeEquals(dto.password, expected)) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }

    const token = await this.jwt.signAsync({ role: 'admin' });
    return { token };
  }

  /** Constant-time comparison to avoid timing side-channels. */
  private safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
