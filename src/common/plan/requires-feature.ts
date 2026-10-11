import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StoreResolver } from '../tenant/store-resolver.service';
import { FEATURE_LABELS, Feature, PLANS, cheapestWith, planOf } from './plans';

const FEATURE_KEY = 'requiredFeature';

/** 402 with an Arabic message the admin shows as an "upgrade" prompt. */
export class PlanRequiredException extends HttpException {
  constructor(message: string, extra: Record<string, unknown> = {}) {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, error: 'Plan Upgrade Required', message, ...extra }, HttpStatus.PAYMENT_REQUIRED);
  }
}

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stores: StoreResolver,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<Feature | undefined>(FEATURE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!feature) return true;
    const plan = planOf(await this.stores.getPlan());
    if (plan.features.includes(feature)) return true;
    const needed = cheapestWith(feature);
    throw new PlanRequiredException(
      `«${FEATURE_LABELS[feature]}» غير متوفرة في باقة «${plan.label}». متوفرة ابتداءً من باقة «${PLANS[needed].label}».`,
      { feature, plan: plan.key, requiredPlan: needed },
    );
  }
}

/**
 * Lock a controller or route to stores whose pack includes `feature`.
 * Put it ABOVE `@UseGuards(AdminAuthGuard)` so authentication runs first.
 */
export function RequiresFeature(feature: Feature) {
  return applyDecorators(SetMetadata(FEATURE_KEY, feature), UseGuards(FeatureGuard));
}
