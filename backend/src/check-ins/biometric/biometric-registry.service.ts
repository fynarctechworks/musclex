import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BIOMETRIC_PROVIDERS,
  type BiometricModality,
  type BiometricProvider,
} from './biometric-provider.interface';

/**
 * Looks up biometric providers by `id` or `modality`. Backed by the
 * DI multi-provider array — every provider that implements the
 * `BiometricProvider` contract registers against the `BIOMETRIC_PROVIDERS`
 * token in CheckInsModule and is immediately discoverable here.
 *
 * Selection rules:
 *  - `forId('zkteco')` — exact id match, throws NotFoundException if absent.
 *  - `defaultFor('face')` — first available provider for that modality.
 *  - `listAvailable()` — UI surface for "which methods can this branch use?"
 */
@Injectable()
export class BiometricRegistry {
  private readonly logger = new Logger(BiometricRegistry.name);

  constructor(@Inject(BIOMETRIC_PROVIDERS) private readonly providers: BiometricProvider[]) {
    const summary = providers
      .map((p) => `${p.id}(${p.modality}${p.isAvailable() ? '' : ', unavailable'})`)
      .join(', ');
    this.logger.log(`Biometric providers registered: ${summary || '(none)'}`);
  }

  forId(id: string): BiometricProvider {
    const p = this.providers.find((x) => x.id === id);
    if (!p) throw new NotFoundException(`Biometric provider not found: ${id}`);
    return p;
  }

  /**
   * Default provider for a modality — picks the first AVAILABLE provider.
   * The order in CheckInsModule's provider array determines preference,
   * so the platform default (face-api-pgvector) registers first.
   */
  defaultFor(modality: BiometricModality): BiometricProvider | null {
    return this.providers.find((p) => p.modality === modality && p.isAvailable()) ?? null;
  }

  listAvailable(): BiometricProvider[] {
    return this.providers.filter((p) => p.isAvailable());
  }

  listAll(): BiometricProvider[] {
    return [...this.providers];
  }
}
