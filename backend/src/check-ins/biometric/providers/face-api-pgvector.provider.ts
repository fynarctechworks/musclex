import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FacialMatcherService } from '../../facial/facial-matcher.service';
import type {
  BiometricEnrollResult,
  BiometricIdentifyResult,
  BiometricInput,
  BiometricProvider,
  BiometricScope,
} from '../biometric-provider.interface';

/**
 * Default face provider: face-api.js descriptors (on-device, no cloud)
 * matched server-side via pgvector + IVFFlat.
 *
 * Identify delegates to FacialMatcherService (Phase 3e).
 * Enroll persists to members.face_vec and the legacy face_descriptor for
 * safe rollback — same dual-write strategy as members.saveFaceDescriptor.
 * Revoke clears the descriptor on the member row.
 *
 * TRD §6 compliance is preserved: face_descriptor is stripped from API
 * responses by StripSecretsInterceptor at the framework level. This
 * provider never echoes the raw template back.
 */
@Injectable()
export class FaceApiPgVectorProvider implements BiometricProvider {
  readonly id = 'face-api-pgvector';
  readonly modality = 'face' as const;
  readonly label = 'face-api.js (on-device, pgvector matched)';

  constructor(
    private readonly matcher: FacialMatcherService,
    private readonly prisma: PrismaService,
  ) {}

  isAvailable(): boolean {
    // pgvector + face-api.js are zero-config: extension is enabled in
    // Phase 3a, models are served from /public/models/ on the frontend.
    return true;
  }

  async identify(
    input: BiometricInput,
    scope: BiometricScope,
  ): Promise<BiometricIdentifyResult | null> {
    if (input.modality !== 'face') return null;

    const match = await this.matcher.match({
      descriptor: input.descriptor,
      branch_id: scope.branch_id,
      gym_id: scope.gym_id,
    });

    if (!match) return null;

    return {
      member_id: match.member_id,
      confidence: match.confidence,
      matcher: this.id,
      elapsed_ms: match.elapsed_ms,
    };
  }

  async enroll(
    member_id: string,
    input: BiometricInput,
    scope: BiometricScope,
  ): Promise<BiometricEnrollResult> {
    if (input.modality !== 'face') {
      throw new Error('FaceApiPgVectorProvider only accepts face inputs');
    }
    if (input.descriptor.length !== 128) {
      throw new Error('Face descriptor must be 128-D');
    }

    const vecLiteral = `[${input.descriptor.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;

    await this.prisma.$transaction([
      this.prisma.member.update({
        where: { id: member_id },
        data: { face_descriptor: input.descriptor },
      }),
      this.prisma.$executeRaw`
        UPDATE studio_template.members SET face_vec = ${vecLiteral}::vector
        WHERE id = ${member_id}::uuid AND gym_id = ${scope.gym_id}::uuid
      `,
    ]);

    // The "template" lives on the member row — there is no separate
    // vendor table. template_ref is the well-known column reference so
    // future cleanup tooling knows where to look.
    return {
      enrollment_id: member_id, // 1:1 with the member for this provider
      template_ref: `members.face_vec:${member_id}`,
    };
  }

  async revoke(enrollment_id: string, scope: BiometricScope): Promise<void> {
    // enrollment_id is the member_id for this provider (1:1 mapping).
    await this.prisma.$transaction([
      this.prisma.member.update({
        where: { id: enrollment_id },
        data: { face_descriptor: [] },
      }),
      this.prisma.$executeRaw`
        UPDATE studio_template.members SET face_vec = NULL
        WHERE id = ${enrollment_id}::uuid AND gym_id = ${scope.gym_id}::uuid
      `,
    ]);
  }
}
