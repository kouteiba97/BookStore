import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface CustomerTokenPayload {
  sub: string;
  store: string;
  role: 'customer';
  /** Customer.tokenVersion when issued; a password change makes it stale. */
  v: number;
}

export const CUSTOMER_AUDIENCE = 'customer';

/**
 * Login tokens for storefront customers. Signed with a secret of their own —
 * CUSTOMER_JWT_SECRET, or else one derived from JWT_SECRET — so a customer
 * token can never pass the admin guard (which checks the admin secret and
 * role) and an admin token can never pass the customer guard.
 */
@Injectable()
export class CustomerTokens {
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const own = config.get<string>('CUSTOMER_JWT_SECRET');
    const admin = config.get<string>('JWT_SECRET') || 'dev-insecure-secret-change-me';
    this.secret = own || createHmac('sha256', admin).update('bayan:customer-tokens:v1').digest('hex');
  }

  sign(customer: { id: string; storeId: string; tokenVersion: number }): Promise<string> {
    const payload: CustomerTokenPayload = { sub: customer.id, store: customer.storeId, role: 'customer', v: customer.tokenVersion };
    return this.jwt.signAsync(payload, { secret: this.secret, audience: CUSTOMER_AUDIENCE, expiresIn: '30d' });
  }

  /** The payload, or null for anything that is not a valid customer token. */
  async verify(token: string): Promise<CustomerTokenPayload | null> {
    try {
      const p = await this.jwt.verifyAsync<CustomerTokenPayload>(token, { secret: this.secret, audience: CUSTOMER_AUDIENCE });
      return p.role === 'customer' && typeof p.sub === 'string' && typeof p.v === 'number' ? p : null;
    } catch {
      return null;
    }
  }
}
