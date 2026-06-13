import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';
import { CreateMemberNoteDto } from './dto/create-member-note.dto';
import { CreateMemberTagDto } from './dto/member-tag.dto';
import { CreateMemberDocumentDto } from './dto/create-member-document.dto';
import { UpdateMemberDocumentDto } from './dto/update-member-document.dto';
import { CreateMemberReferralDto } from './dto/member-referral.dto';

@Injectable()
export class MemberCrmService {
  constructor(private tenant: TenantPrisma) {}

  // ── Notes ─────────────────────────────────────────────────────

  async getNotes(memberId: string) {
    return this.tenant.client.memberNote.findMany({
      where: { member_id: memberId },
      include: {
        staff: { select: { id: true, full_name: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createNote(memberId: string, dto: CreateMemberNoteDto) {
    const member = await this.tenant.client.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.tenant.client.memberNote.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: memberId,
        staff_id: dto.staff_id,
        note: dto.note,
      },
      include: {
        staff: { select: { id: true, full_name: true, role: true } },
      },
    });
  }

  async deleteNote(noteId: string) {
    const note = await this.tenant.client.memberNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    return this.tenant.client.memberNote.delete({ where: { id: noteId } });
  }

  // ── Tags ──────────────────────────────────────────────────────

  async getAllTags() {
    return this.tenant.client.memberTag.findMany({
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createTag(dto: CreateMemberTagDto) {
    const existing = await this.tenant.client.memberTag.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Tag already exists');

    return this.tenant.client.memberTag.create({
      data: { gym_id: getTenantGymId()!, name: dto.name, color: dto.color, description: dto.description },
    });
  }

  async deleteTag(tagId: string) {
    const tag = await this.tenant.client.memberTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.tenant.client.memberTag.delete({ where: { id: tagId } });
  }

  async getMemberTags(memberId: string) {
    return this.tenant.client.memberTagAssignment.findMany({
      where: { member_id: memberId },
      include: { tag: true },
    });
  }

  async assignTag(memberId: string, tagId: string) {
    const [member, tag] = await Promise.all([
      this.tenant.client.member.findUnique({ where: { id: memberId } }),
      this.tenant.client.memberTag.findUnique({ where: { id: tagId } }),
    ]);
    if (!member) throw new NotFoundException('Member not found');
    if (!tag) throw new NotFoundException('Tag not found');

    const existing = await this.tenant.client.memberTagAssignment.findUnique({
      where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
    });
    if (existing) throw new ConflictException('Tag already assigned to this member');

    return this.tenant.client.memberTagAssignment.create({
      data: { gym_id: getTenantGymId()!, member_id: memberId, tag_id: tagId },
      include: { tag: true },
    });
  }

  async removeTag(memberId: string, tagId: string) {
    const assignment = await this.tenant.client.memberTagAssignment.findUnique({
      where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
    });
    if (!assignment) throw new NotFoundException('Tag assignment not found');

    return this.tenant.client.memberTagAssignment.delete({
      where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
    });
  }

  // ── Documents ─────────────────────────────────────────────────

  async getDocuments(memberId: string) {
    return this.tenant.client.memberDocument.findMany({
      where: { member_id: memberId },
      orderBy: { uploaded_at: 'desc' },
    });
  }

  async uploadDocument(memberId: string, dto: CreateMemberDocumentDto) {
    const member = await this.tenant.client.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.tenant.client.memberDocument.create({
      data: {
        gym_id: getTenantGymId()!,
        member_id: memberId,
        document_type: dto.document_type,
        file_url: dto.file_url,
        file_name: dto.file_name,
        file_size: dto.file_size,
        description: dto.description,
        expires_at: dto.expires_at ? new Date(dto.expires_at) : undefined,
      },
    });
  }

  async updateDocument(documentId: string, dto: UpdateMemberDocumentDto) {
    const doc = await this.tenant.client.memberDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');

    return this.tenant.client.memberDocument.update({
      where: { id: documentId },
      data: {
        ...(dto.document_type !== undefined && { document_type: dto.document_type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.expires_at !== undefined && { expires_at: dto.expires_at ? new Date(dto.expires_at) : null }),
      },
    });
  }

  async deleteDocument(documentId: string) {
    const doc = await this.tenant.client.memberDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.tenant.client.memberDocument.delete({ where: { id: documentId } });
  }

  // ── Referrals ─────────────────────────────────────────────────

  async getReferrals(memberId: string) {
    return this.tenant.client.memberReferral.findMany({
      where: {
        OR: [
          { referrer_member_id: memberId },
          { referred_member_id: memberId },
        ],
      },
      include: {
        referrer: { select: { id: true, full_name: true, member_code: true } },
        referred: { select: { id: true, full_name: true, member_code: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createReferral(dto: CreateMemberReferralDto) {
    const [referrer, referred] = await Promise.all([
      this.tenant.client.member.findUnique({ where: { id: dto.referrer_member_id } }),
      this.tenant.client.member.findUnique({ where: { id: dto.referred_member_id } }),
    ]);
    if (!referrer) throw new NotFoundException('Referrer member not found');
    if (!referred) throw new NotFoundException('Referred member not found');

    const existing = await this.tenant.client.memberReferral.findUnique({
      where: {
        referrer_member_id_referred_member_id: {
          referrer_member_id: dto.referrer_member_id,
          referred_member_id: dto.referred_member_id,
        },
      },
    });
    if (existing) throw new ConflictException('Referral already exists');

    return this.tenant.client.memberReferral.create({
      data: {
        gym_id: getTenantGymId()!,
        referrer_member_id: dto.referrer_member_id,
        referred_member_id: dto.referred_member_id,
        reward_type: dto.reward_type,
        reward_value: dto.reward_value,
      },
      include: {
        referrer: { select: { id: true, full_name: true, member_code: true } },
        referred: { select: { id: true, full_name: true, member_code: true } },
      },
    });
  }

  async updateReferralStatus(referralId: string, status: string) {
    const referral = await this.tenant.client.memberReferral.findUnique({ where: { id: referralId } });
    if (!referral) throw new NotFoundException('Referral not found');

    return this.tenant.client.memberReferral.update({
      where: { id: referralId },
      data: {
        reward_status: status,
        ...(status === 'awarded' && { awarded_at: new Date() }),
      },
    });
  }
}
