import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';

/**
 * Staff biometric enrollment + attendance pipeline.
 *
 * Mirrors BiometricEnrollmentService for the member side but writes to
 * `staff_biometric_enrollments` and uses `staff.face_vec` for matching.
 * Successful identification routes to StaffAttendance (clock-in/clock-out)
 * rather than the member CheckIn table — payroll and access control consume
 * different signals.
 *
 * Dual-write on enroll: face_descriptor (Float[]) for rollback + face_vec
 * (pgvector) for the IVFFlat-indexed matcher. Revoke flips revoked_at and
 * clears both columns. TRD §6: face_descriptor is stripped from API
 * responses by StripSecretsInterceptor; this service never echoes templates.
 */
@Injectable()
export class StaffBiometricsService {
  private readonly logger = new Logger(StaffBiometricsService.name);
  private readonly providerId = 'face-api-pgvector';
  // Match threshold mirrors the member-side matcher. Tunable per-tenant later.
  private readonly matchThreshold = 0.5;

  constructor(private readonly prisma: PrismaService) {}

  // ── Enroll ────────────────────────────────────────────────────────────────
  async enrollFace(input: {
    staff_id: string;
    descriptor: number[];
    enrolled_by: string;
    consent_log_id?: string | null;
  }) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context missing');
    if (!Array.isArray(input.descriptor) || input.descriptor.length !== 128) {
      throw new BadRequestException(
        'Face descriptor must be a 128-element array',
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: input.staff_id },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const vecLiteral = `[${input.descriptor
      .map((n) => (Number.isFinite(n) ? n : 0))
      .join(',')}]`;

    await this.prisma.$transaction([
      this.prisma.staff.update({
        where: { id: input.staff_id },
        data: { face_descriptor: input.descriptor },
      }),
      this.prisma.$executeRaw`
        UPDATE studio_template.staff SET face_vec = ${vecLiteral}::vector
        WHERE id = ${input.staff_id}::uuid AND gym_id = ${gymId}::uuid
      `,
    ]);

    const row = await this.prisma.staffBiometricEnrollment.upsert({
      where: {
        staff_id_modality_provider: {
          staff_id: input.staff_id,
          modality: 'face',
          provider: this.providerId,
        },
        // Explicit tenant scope (Prisma extendedWhereUnique) — see biometric-enrollment.service.
        gym_id: gymId,
      },
      create: {
        gym_id: gymId,
        staff_id: input.staff_id,
        provider: this.providerId,
        modality: 'face',
        template_ref: `staff.face_vec:${input.staff_id}`,
        consent_log_id: input.consent_log_id ?? null,
        enrolled_by: input.enrolled_by,
      },
      update: {
        template_ref: `staff.face_vec:${input.staff_id}`,
        consent_log_id: input.consent_log_id ?? null,
        enrolled_by: input.enrolled_by,
        revoked_at: null,
      },
      select: {
        id: true,
        provider: true,
        modality: true,
        staff_id: true,
        enrolled_at: true,
      },
    });

    this.logger.log(
      `Enrolled staff=${input.staff_id} provider=${this.providerId} enrollment=${row.id}`,
    );
    return row;
  }

  // ── Revoke ────────────────────────────────────────────────────────────────
  async revoke(enrollment_id: string, revoked_by: string) {
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context missing');

    const enrollment = await this.prisma.staffBiometricEnrollment.findUnique({
      where: { id: enrollment_id },
      select: {
        id: true,
        provider: true,
        modality: true,
        staff_id: true,
        revoked_at: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.revoked_at) {
      return { ...enrollment, already_revoked: true };
    }

    await this.prisma.$transaction([
      this.prisma.staff.update({
        where: { id: enrollment.staff_id },
        data: { face_descriptor: [] },
      }),
      this.prisma.$executeRaw`
        UPDATE studio_template.staff SET face_vec = NULL
        WHERE id = ${enrollment.staff_id}::uuid AND gym_id = ${gymId}::uuid
      `,
      this.prisma.staffBiometricEnrollment.update({
        where: { id: enrollment_id },
        data: { revoked_at: new Date() },
      }),
    ]);

    this.logger.log(
      `Revoked staff enrollment=${enrollment_id} staff=${enrollment.staff_id} by=${revoked_by}`,
    );
    return { ...enrollment, already_revoked: false };
  }

  // ── List ──────────────────────────────────────────────────────────────────
  async listForStaff(staff_id: string) {
    return this.prisma.staffBiometricEnrollment.findMany({
      where: { staff_id },
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

  async listAll(opts: { include_revoked?: boolean }) {
    const where: any = {};
    if (!opts.include_revoked) where.revoked_at = null;

    return this.prisma.staffBiometricEnrollment.findMany({
      where,
      select: {
        id: true,
        staff_id: true,
        provider: true,
        modality: true,
        enrolled_at: true,
        revoked_at: true,
        staff: {
          select: {
            id: true,
            full_name: true,
            employee_code: true,
            role: true,
            job_title: true,
            status: true,
          },
        },
      },
      orderBy: [{ enrolled_at: 'desc' }],
      take: 500,
    });
  }

  // ── Identify (pgvector match) ─────────────────────────────────────────────
  async identifyByFace(input: { descriptor: number[]; branch_id: string }) {
    if (!Array.isArray(input.descriptor) || input.descriptor.length !== 128) {
      return null;
    }
    const gymId = getTenantGymId();
    if (!gymId) throw new BadRequestException('Tenant context missing');
    const vecLiteral = `[${input.descriptor
      .map((n) => (Number.isFinite(n) ? n : 0))
      .join(',')}]`;

    // Match against staff with a face_vec who are active. Branch scoping is
    // soft: a staff member assigned to multiple branches can still clock in
    // at any branch they have access to — branch_ids[] check would be the
    // strict path, but Prisma raw + array contains gets gnarly. For now we
    // scope by gym only and rely on the orchestrator to reject out-of-scope.
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; full_name: string; distance: number }>
    >`
      SELECT id, full_name, (face_vec <=> ${vecLiteral}::vector)::float8 AS distance
      FROM studio_template.staff
      WHERE face_vec IS NOT NULL
        AND gym_id = ${gymId}::uuid
        AND status = 'active'
      ORDER BY face_vec <=> ${vecLiteral}::vector
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    const best = rows[0];
    if (best.distance >= this.matchThreshold) return null;

    return {
      staff_id: best.id,
      full_name: best.full_name,
      confidence: Math.max(0, 1 - best.distance),
      matcher: this.providerId,
    };
  }

  // ── Clock in / out (face-driven) ──────────────────────────────────────────
  // Pairs with StaffAttendance: pin the staff's most recent open attendance row
  // for the day (check_out_time IS NULL) — if found, close it; otherwise open
  // a new one.
  async clockByFace(input: { descriptor: number[]; branch_id: string }) {
    const match = await this.identifyByFace(input);
    if (!match) {
      return {
        success: false,
        failure_reason: 'no_match',
        message: "We couldn't recognize that face.",
      };
    }

    return this.toggleAttendance({
      staff_id: match.staff_id,
      branch_id: input.branch_id,
      method: 'biometric',
      full_name: match.full_name,
    });
  }

  async clockManual(input: {
    staff_id: string;
    branch_id: string;
    notes?: string;
  }) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: input.staff_id },
      select: { id: true, full_name: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    return this.toggleAttendance({
      staff_id: input.staff_id,
      branch_id: input.branch_id,
      method: 'manual',
      notes: input.notes,
      full_name: staff.full_name,
    });
  }

  private async toggleAttendance(input: {
    staff_id: string;
    branch_id: string;
    method: string;
    notes?: string;
    full_name: string;
  }) {
    const open = await this.prisma.staffAttendance.findFirst({
      where: {
        staff_id: input.staff_id,
        branch_id: input.branch_id,
        check_out_time: null,
      },
      orderBy: { check_in_time: 'desc' },
    });

    if (open) {
      const closed = await this.prisma.staffAttendance.update({
        where: { id: open.id },
        data: { check_out_time: new Date() },
      });
      const durationMs =
        closed.check_out_time!.getTime() - closed.check_in_time.getTime();
      return {
        success: true,
        direction: 'out' as const,
        attendance: closed,
        staff_id: input.staff_id,
        full_name: input.full_name,
        duration_minutes: Math.max(0, Math.round(durationMs / 60_000)),
      };
    }

    const gymId = getTenantGymId();
    const opened = await this.prisma.staffAttendance.create({
      data: {
        gym_id: gymId!,
        staff_id: input.staff_id,
        branch_id: input.branch_id,
        check_in_time: new Date(),
        method: input.method,
        notes: input.notes,
      },
    });
    return {
      success: true,
      direction: 'in' as const,
      attendance: opened,
      staff_id: input.staff_id,
      full_name: input.full_name,
    };
  }
}
