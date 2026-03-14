import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthIdentityService } from './auth-identity.service';
import { AuthDeviceService } from './auth-device.service';
import { AuthLoginHistoryService } from './auth-login-history.service';
import { AuthSessionService } from './auth-session.service';
import { AuthSsoService } from './auth-sso.service';
import { AuthApiKeyService } from './auth-api-key.service';
import { RbacService } from './rbac.service';
import { RbacSeedService } from './rbac-seed.service';
import { AuthSessionController, AuthAdminController } from './auth-session.controller';
import { AuthSsoController } from './auth-sso.controller';
import { AuthApiKeyController } from './auth-api-key.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [
    AuthController,
    AuthSessionController,
    AuthAdminController,
    AuthSsoController,
    AuthApiKeyController,
  ],
  providers: [
    AuthService,
    AuthIdentityService,
    AuthDeviceService,
    AuthLoginHistoryService,
    AuthSessionService,
    AuthSsoService,
    AuthApiKeyService,
    RbacService,
    RbacSeedService,
  ],
  exports: [
    AuthService,
    AuthIdentityService,
    AuthDeviceService,
    AuthLoginHistoryService,
    AuthSessionService,
    RbacService,
    RbacSeedService,
  ],
})
export class AuthModule {}
