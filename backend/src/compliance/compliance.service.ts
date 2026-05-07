import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Consent Management ────────────────────────────────────

  async recordConsent(
    memberId: string,
    consentType: string,
    granted: boolean,
    ipAddress?: string,
    recordedBy?: string,
  ) {
    // Upsert consent record
    const existing = await this.prisma.consentLog.findFirst({
      where: { member_id: memberId, consent_type: consentType },
      orderBy: { created_at: 'desc' },
    });

    const consent = await this.prisma.consentLog.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: memberId,
        consent_type: consentType,
        granted,
        ip_address: ipAddress || null,
        recorded_by: recordedBy || null,
        previous_value: existing?.granted ?? null,
      },
    });

    this.logger.log(
      `Consent ${consentType} ${granted ? 'granted' : 'revoked'} for member ${memberId}`,
    );
    return consent;
  }

  async getMemberConsents(memberId: string) {
    // Get latest consent for each type
    const allConsents = await this.prisma.consentLog.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: 'desc' },
    });

    // Group by type, take latest
    const latestByType = new Map<string, (typeof allConsents)[0]>();
    for (const consent of allConsents) {
      if (!latestByType.has(consent.consent_type)) {
        latestByType.set(consent.consent_type, consent);
      }
    }

    return {
      member_id: memberId,
      consents: Array.from(latestByType.values()).map((c) => ({
        consent_type: c.consent_type,
        granted: c.granted,
        recorded_at: c.created_at,
        ip_address: c.ip_address,
      })),
    };
  }

  async getConsentHistory(memberId: string) {
    return this.prisma.consentLog.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Data Export (Right to Portability - GDPR Art. 20) ─────

  async requestDataExport(memberId: string, format: 'json' | 'csv' = 'json') {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Create export request record
    const request = await this.prisma.dataRequest.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: memberId,
        type: 'export',
        format,
        status: 'processing',
      },
    });

    // Collect all member data
    const exportData = await this.collectMemberData(memberId);

    // Mark request complete
    await this.prisma.dataRequest.update({
      where: { id: request.id },
      data: {
        status: 'completed',
        completed_at: new Date(),
        data_snapshot: exportData as any,
      },
    });

    this.logger.log(`Data export completed for member ${memberId} (${format})`);

    return {
      request_id: request.id,
      status: 'completed',
      format,
      data: exportData,
    };
  }

  private async collectMemberData(memberId: string) {
    const [
      member,
      profile,
      memberships,
      checkIns,
      payments,
      bookings,
      consents,
    ] = await Promise.all([
      this.prisma.member.findUnique({
        where: { id: memberId },
        select: {
          id: true, full_name: true, email: true,
          phone: true, date_of_birth: true, gender: true,
          emergency_contact_name: true, emergency_contact_phone: true,
          member_code: true, status: true, created_at: true,
        },
      }),
      this.prisma.memberProfile.findUnique({
        where: { member_id: memberId },
      }).catch(() => null),
      this.prisma.memberMembership.findMany({
        where: { member_id: memberId },
        select: {
          id: true, plan_id: true, start_date: true, end_date: true,
          status: true, created_at: true,
        },
      }),
      this.prisma.checkIn.findMany({
        where: { member_id: memberId },
        select: {
          id: true, checked_in_at: true,
          checkin_method: true, branch_id: true,
        },
        orderBy: { checked_in_at: 'desc' },
        take: 1000,
      }),
      this.prisma.payment.findMany({
        where: { member_id: memberId },
        select: {
          id: true, amount: true, payment_method: true,
          paid_at: true, status: true, receipt_number: true,
        },
        orderBy: { paid_at: 'desc' },
        take: 1000,
      }),
      this.prisma.classBooking.findMany({
        where: { member_id: memberId },
        select: {
          id: true, booking_status: true, booked_at: true,
        },
        take: 1000,
      }),
      this.prisma.consentLog.findMany({
        where: { member_id: memberId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return {
      exported_at: new Date().toISOString(),
      member: {
        personal_info: member,
        profile,
      },
      memberships,
      check_ins: checkIns,
      payments,
      class_bookings: bookings,
      consent_history: consents,
    };
  }

  // ─── Data Deletion (Right to Erasure - GDPR Art. 17) ──────

  async requestDataDeletion(memberId: string, reason?: string, requestedBy?: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Create deletion request record
    const request = await this.prisma.dataRequest.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: memberId,
        type: 'deletion',
        status: 'pending',
        reason,
        requested_by: requestedBy,
      },
    });

    this.logger.log(`Data deletion requested for member ${memberId}: ${request.id}`);

    return {
      request_id: request.id,
      status: 'pending',
      message: 'Deletion request recorded. Will be processed within 30 days per GDPR requirements.',
    };
  }

  async processDeletion(requestId: string, processedBy: string) {
    const request = await this.prisma.dataRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Deletion request not found');
    if (request.type !== 'deletion') throw new Error('Not a deletion request');
    if (request.status === 'completed') throw new Error('Request already processed');

    const memberId = request.member_id;

    // Anonymize personal data instead of hard-deleting (preserves analytics)
    await this.prisma.member.update({
      where: { id: memberId },
      data: {
        full_name: 'DELETED USER',
        email: `deleted_${memberId.substring(0, 8)}@anonymized.local`,
        phone: '0000000000',
        date_of_birth: null,
        gender: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        profile_photo_url: null,
        face_descriptor: [],
        notes: null,
        status: 'inactive',
      },
    });

    // Delete profile
    await this.prisma.memberProfile.deleteMany({
      where: { member_id: memberId },
    });

    // Delete body stats
    await this.prisma.memberBodyStats.deleteMany({
      where: { member_id: memberId },
    });

    // Delete notes
    await this.prisma.memberNote.deleteMany({
      where: { member_id: memberId },
    });

    // Delete documents
    await this.prisma.memberDocument.deleteMany({
      where: { member_id: memberId },
    });

    // Delete consent logs
    await this.prisma.consentLog.deleteMany({
      where: { member_id: memberId },
    });

    // Mark request as completed
    await this.prisma.dataRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completed_at: new Date(),
        processed_by: processedBy,
      },
    });

    this.logger.log(`Data deletion completed for member ${memberId} (request ${requestId})`);

    return {
      request_id: requestId,
      status: 'completed',
      anonymized: true,
      message: 'Personal data anonymized. Transactional records retained for legal compliance.',
    };
  }

  async getDeletionRequests(status?: string) {
    return this.prisma.dataRequest.findMany({
      where: {
        type: 'deletion',
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Data Retention Policy ─────────────────────────────────

  async getRetentionPolicy() {
    return {
      personal_data: {
        retention_period: '3 years after membership ends',
        legal_basis: 'Legitimate interest + contract fulfillment',
      },
      payment_records: {
        retention_period: '7 years',
        legal_basis: 'Legal obligation (tax/accounting)',
      },
      check_in_logs: {
        retention_period: '2 years',
        legal_basis: 'Legitimate interest (security)',
      },
      consent_logs: {
        retention_period: 'Indefinite',
        legal_basis: 'Legal obligation (proof of consent)',
      },
      facial_recognition_data: {
        retention_period: 'Until consent revoked or membership ends',
        legal_basis: 'Explicit consent only',
      },
    };
  }
}
