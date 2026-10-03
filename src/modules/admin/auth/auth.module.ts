import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';

/**
 * Registers JwtModule globally so AdminAuthGuard can inject JwtService from
 * any module without re-importing.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        // A guessable fallback secret in production would let anyone mint an
        // admin token, so refuse to boot instead.
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET must be set in production');
        }
        return {
          secret: secret || 'dev-insecure-secret-change-me',
          signOptions: { expiresIn: '30d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
})
export class AuthModule {}
