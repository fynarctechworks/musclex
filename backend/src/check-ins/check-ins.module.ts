import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { CheckInsGateway } from './check-ins.gateway';
import { QrController } from './qr/qr.controller';
import { QrTokenService } from './qr/qr-token.service';
import { QrNonceStore } from './qr/qr-nonce.store';
import { FacialMatcherService } from './facial/facial-matcher.service';
import { BiometricController } from './biometric/biometric.controller';
import { BiometricRegistry } from './biometric/biometric-registry.service';
import { BiometricEnrollmentService } from './biometric/biometric-enrollment.service';
import { BIOMETRIC_PROVIDERS } from './biometric/biometric-provider.interface';
import { FaceApiPgVectorProvider } from './biometric/providers/face-api-pgvector.provider';
import { ZkTecoFingerprintProvider } from './biometric/providers/zkteco.provider';
import { DevicesService } from './devices/devices.service';
import { DevicesController } from './devices/devices.controller';
import { DeviceCheckInController } from './devices/device-checkin.controller';
import { DeviceAuthMiddleware } from './devices/device-auth.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AccessPolicyEngine } from './policy/access-policy.engine';
import { AccessScopeResolver } from './policy/access-scope.resolver';
import { CheckInOrchestrator } from './policy/check-in.orchestrator';
import { CHECK_IN_RULES } from './policy/rule.interface';
import { ALL_RULE_PROVIDERS } from './policy/rules';

// Biometric providers, in selection-preference order. The registry picks
// the first AVAILABLE provider per modality as the default, so the
// platform default (face-api-pgvector) sits before any cloud / hardware
// alternative.
const BIOMETRIC_PROVIDER_CLASSES = [FaceApiPgVectorProvider, ZkTecoFingerprintProvider];

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [
    CheckInsController,
    QrController,
    BiometricController,
    DevicesController,
    DeviceCheckInController,
  ],
  providers: [
    CheckInsService,
    CheckInOrchestrator,
    AccessPolicyEngine,
    AccessScopeResolver,
    CheckInsGateway,
    QrTokenService,
    QrNonceStore,
    FacialMatcherService,
    BiometricRegistry,
    BiometricEnrollmentService,
    DevicesService,
    DeviceAuthMiddleware,
    ...BIOMETRIC_PROVIDER_CLASSES,
    {
      provide: BIOMETRIC_PROVIDERS,
      useFactory: (...providers) => providers,
      inject: BIOMETRIC_PROVIDER_CLASSES,
    },
    ...ALL_RULE_PROVIDERS,
    {
      provide: CHECK_IN_RULES,
      useFactory: (...rules) => rules,
      inject: ALL_RULE_PROVIDERS,
    },
  ],
  exports: [CheckInsService, CheckInsGateway, QrTokenService, BiometricRegistry, DevicesService, CheckInOrchestrator],
})
export class CheckInsModule implements NestModule {
  // DeviceAuthMiddleware ONLY runs on hardware-scanner requests. JWT-based
  // routes (CheckInsController, QrController, BiometricController,
  // DevicesController) keep their existing guard chain untouched.
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DeviceAuthMiddleware)
      .forRoutes({
        path: 'api/v1/check-ins/device/:device_id/scan',
        method: RequestMethod.POST,
      });
  }
}
