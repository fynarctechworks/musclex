import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../../common/tenant-context';
import { BiometricRegistry } from './biometric-registry.service';
import type {
  BiometricInput,
  BiometricModality,
} from './biometric-provider.interface';

/**
 * Coordinates biometric enrollment: delegates the vendor-specific write
 * to the chosen provider, then records an immutable row in
 * `biometric_enrollments` for the audit trail.
 *
 * Revoke flips `revoked_at` instead of deleting the row — TRD §6 audit
 * posture: never erase enrollment history. The provider clears the
 * template itself.
 *
 * One enrollment per (member_id, modality, provider) — enforced by the
 * UNIQUE index on biometric_enrollments.
 */
@Injectable()
export class BiometricEnrollmentService {
  private readonly logger = new Logger(BiometricEnrollmentService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly registry: BiometricRegistry,
  ) {}

  async enroll(input: {
    member_id: string;
    branch_id: string;
    provider_id?: string;
    modality: BiometricModality;
    enrolled_by: string;
    consent_log_id?: string | null;
    payload: BiometricInput;
  }) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context missing');

    if (input.payload.modality !== input.modality) {
      throw new BadRequestException(
        'payload.modality does not match requested modality',
      );
    }

    const provider = input.provider_id
      ? this.registry.forId(input.provider_id)
      : this.registry.defaultFor(input.modality);
    if (!provider) {
      throw new BadRequestException(
        `No available provider for modality: ${input.modality}`,
      );
    }
    if (!provider.isAvailable()) {
      throw new BadRequestException(`Provider ${provider.id} is not available`);
    }

    const result = await provider.enroll(input.member_id, input.payload, {
      gym_id: gymId,
      branch_id: input.branch_id,
    });

    // Upsert: re-enrolling overwrites the prior row's template_ref but
    // keeps the same id so existing references stay valid.
    const row = await this.tenant.client.biometricEnrollment.upsert({
      where: {
        member_id_modality_provider: {
          member_id: input.member_id,
          modality: input.modality,
          provider: provider.id,
        },
        // Explicit tenant scope (Prisma extendedWhereUnique): the model is now a
        // registered tenant model, and this makes the gym filter visible at the
        // call site rather than relying solely on $use injection.
        gym_id: gymId,
      },
      create: {
        gym_id: gymId,
        member_id: input.member_id,
        provider: provider.id,
        modality: input.modality,
        template_ref: result.template_ref,
        consent_log_id: input.consent_log_id ?? null,
        enrolled_by: input.enrolled_by,
      },
      update: {
        template_ref: result.template_ref,
        consent_log_id: input.consent_log_id ?? null,
        enrolled_by: input.enrolled_by,
        revoked_at: null,
      },
      select: {
        id: true,
        provider: true,
        modality: true,
        member_id: true,
        enrolled_at: true,
      },
    });

    this.logger.log(
      `Enrolled member=${input.member_id} modality=${input.modality} provider=${provider.id} enrollment=${row.id}`,
    );

    return row;
  }

  async revoke(enrollment_id: string, branch_id: string, revoked_by: string) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context missing');

    const enrollment = await this.tenant.client.biometricEnrollment.findUnique({
      where: { id: enrollment_id },
      select: {
        id: true,
        provider: true,
        modality: true,
        member_id: true,
        revoked_at: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.revoked_at) {
      return { ...enrollment, already_revoked: true };
    }

    const provider = this.registry.forId(enrollment.provider);
    await provider.revoke(enrollment.member_id, { gym_id: gymId, branch_id });

    const updated = await this.tenant.client.biometricEnrollment.update({
      where: { id: enrollment_id },
      data: { revoked_at: new Date() },
      select: {
        id: true,
        provider: true,
        modality: true,
        member_id: true,
        revoked_at: true,
      },
    });

    this.logger.log(
      `Revoked enrollment=${enrollment_id} provider=${enrollment.provider} member=${enrollment.member_id} by=${revoked_by}`,
    );

    return { ...updated, already_revoked: false };
  }

  async listForMember(member_id: string) {
    return this.tenant.client.biometricEnrollment.findMany({
      where: { member_id },
      select: {
        id: true,
        provider: true,
        modality: true,
        enrolled_at: true,
        revoked_at: true,
      },
      orderBy: [{ modality: 'asc' }, { enrolled_at: 'desc' }],
    });
  }

  // Tenant-wide listing for the Biometrics admin page. Joins to the member so
  // the UI can render name + member_code without a second round-trip.
  async listAll(opts: {
    modality?: 'face' | 'fingerprint' | 'iris' | 'palm';
    include_revoked?: boolean;
  }) {
    const where: any = {};
    if (opts.modality) where.modality = opts.modality;
    if (!opts.include_revoked) where.revoked_at = null;

    return this.tenant.client.biometricEnrollment.findMany({
      where,
      select: {
        id: true,
        member_id: true,
        provider: true,
        modality: true,
        enrolled_at: true,
        revoked_at: true,
        member: {
          select: {
            id: true,
            full_name: true,
            member_code: true,
            profile_photo_url: true,
            status: true,
          },
        },
      },
      orderBy: [{ enrolled_at: 'desc' }],
      take: 500,
    });
  }
}
