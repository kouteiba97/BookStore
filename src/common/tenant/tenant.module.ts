import { Global, Module } from '@nestjs/common';
import { StoreResolver } from './store-resolver.service';

/**
 * The store this deployment serves. Global so the admin guard — which runs in
 * every module that protects a route — can check tenancy without each module
 * re-importing it.
 */
@Global()
@Module({
  providers: [StoreResolver],
  exports: [StoreResolver],
})
export class TenantModule {}
