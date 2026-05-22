import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BiometricEnrollResult,
  BiometricIdentifyResult,
  BiometricInput,
  BiometricProvider,
  BiometricScope,
} from '../biometric-provider.interface';

/**
 * ZKTeco fingerprint adapter — STUB.
 *
 * This file is intentionally a scaffold. It demonstrates how a fingerprint
 * vendor plugs in:
 *   1. Implement BiometricProvider with `modality: 'fingerprint'`.
 *   2. Wire it into CheckInsModule's BIOMETRIC_PROVIDERS array.
 *   3. Set env vars to enable (e.g. ZKTECO_DEVICE_HOST, ZKTECO_API_KEY).
 *   4. Persist vendor templates in a dedicated table (NOT raw bytes on
 *      members) and write the template_ref to biometric_enrollments.
 *
 * Real ZKTeco integrations talk to a local USB SDK or a network appliance.
 * That code lives in Phase 4+; this stub keeps the registry honest and
 * prevents code from being added that assumes "face is the only modality".
 */
@Injectable()
export class ZkTecoFingerprintProvider implements BiometricProvider {
  readonly id = 'zkteco';
  readonly modality = 'fingerprint' as const;
  readonly label = 'ZKTeco fingerprint (USB / appliance)';

  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    // Disabled until ZKTECO_DEVICE_HOST is set. The registry skips
    // unavailable providers from defaults, so this never gets called
    // by the orchestrator unless explicitly requested by id.
    return Boolean(this.config.get<string>('ZKTECO_DEVICE_HOST'));
  }

  async identify(_input: BiometricInput, _scope: BiometricScope): Promise<BiometricIdentifyResult | null> {
    throw new NotImplementedException(
      'ZKTeco fingerprint identify is not implemented yet. Provider is a scaffold.',
    );
  }

  async enroll(_member_id: string, _input: BiometricInput, _scope: BiometricScope): Promise<BiometricEnrollResult> {
    throw new NotImplementedException(
      'ZKTeco fingerprint enroll is not implemented yet. Provider is a scaffold.',
    );
  }

  async revoke(_enrollment_id: string, _scope: BiometricScope): Promise<void> {
    throw new NotImplementedException(
      'ZKTeco fingerprint revoke is not implemented yet. Provider is a scaffold.',
    );
  }
}
