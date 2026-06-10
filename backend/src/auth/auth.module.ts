import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController, TwoFactorRecoveryController } from './two-factor.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SccSyncService } from '../common/services/scc-sync.service';
import { RazorpayService } from '../payments/razorpay.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    EventEmitterModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRY', '1h') as any },
      }),
    }),
  ],
  controllers: [
    AuthController,
    AuthSessionController,
    AuthAdminController,
    AuthSsoController,
    AuthApiKeyController,
    TwoFactorController,
    TwoFactorRecoveryController,
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
    TwoFactorService,
    SccSyncService,
    RazorpayService,
  ],
  exports: [
    AuthService,
    AuthIdentityService,
    AuthDeviceService,
    AuthLoginHistoryService,
    AuthSessionService,
    RbacService,
    RbacSeedService,
    TwoFactorService,
  ],
})
export class AuthModule {}
