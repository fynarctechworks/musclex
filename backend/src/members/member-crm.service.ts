import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberNoteDto } from './dto/create-member-note.dto';
import { CreateMemberTagDto } from './dto/member-tag.dto';
import { CreateMemberDocumentDto } from './dto/create-member-document.dto';
import { UpdateMemberDocumentDto } from './dto/update-member-document.dto';
import { CreateMemberReferralDto } from './dto/member-referral.dto';

@Injectable()
export class MemberCrmService {
  constructor(private prisma: PrismaService) {}

  // ── Notes ─────────────────────────────────────────────────────

  async getNotes(memberId: string) {
    return this.prisma.memberNote.findMany({
      where: { member_id: memberId },
      include: {
        staff: { select: { id: true, full_name: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createNote(memberId: string, dto: CreateMemberNoteDto) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.memberNote.create({
      data: {
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
    const note = await this.prisma.memberNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');
    return this.prisma.memberNote.delete({ where: { id: noteId } });
  }

  // ── Tags ──────────────────────────────────────────────────────

  async getAllTags() {
    return this.prisma.memberTag.findMany({
      include: { _count: { select: { assignments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createTag(dto: CreateMemberTagDto) {
    const existing = await this.prisma.memberTag.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Tag already exists');

    return this.prisma.memberTag.create({
      data: { name: dto.name, color: dto.color, description: dto.description },
    });
  }

  async deleteTag(tagId: string) {
    const tag = await this.prisma.memberTag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');
    return this.prisma.memberTag.delete({ where: { id: tagId } });
  }

  async getMemberTags(memberId: string) {
    return this.prisma.memberTagAssignment.findMany({
      where: { member_id: memberId },
      include: { tag: true },
    });
  }

  async assignTag(memberId: string, tagId: string) {
    const [member, tag] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: memberId } }),
      this.prisma.memberTag.findUnique({ where: { id: tagId } }),
    ]);
    if (!member) throw new NotFoundException('Member not found');
    if (!tag) throw new NotFoundException('Tag not found');

    const existing = await this.prisma.memberTagAssignment.findUnique({
      where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
    });
    if (existing) throw new ConflictException('Tag already assigned to this member');

    return this.prisma.memberTagAssignment.create({
      data: { member_id: memberId, tag_id: tagId },
      include: { tag: true },
    });
  }

  async removeTag(memberId: string, tagId: string) {
    const assignment = await this.prisma.memberTagAssignment.findUnique({
      where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
    });
    if (!assignment) throw new NotFoundException('Tag assignment not found');

    return this.prisma.memberTagAssignment.delete({
      where: { member_id_tag_id: { member_id: memberId, tag_id: tagId } },
    });
  }

  // ── Documents ─────────────────────────────────────────────────

  async getDocuments(memberId: string) {
    return this.prisma.memberDocument.findMany({
      where: { member_id: memberId },
      orderBy: { uploaded_at: 'desc' },
    });
  }

  async uploadDocument(memberId: string, dto: CreateMemberDocumentDto) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.memberDocument.create({
      data: {
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
    const doc = await this.prisma.memberDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.memberDocument.update({
      where: { id: documentId },
      data: {
        ...(dto.document_type !== undefined && { document_type: dto.document_type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.expires_at !== undefined && { expires_at: dto.expires_at ? new Date(dto.expires_at) : null }),
      },
    });
  }

  async deleteDocument(documentId: string) {
    const doc = await this.prisma.memberDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.memberDocument.delete({ where: { id: documentId } });
  }

  // ── Referrals ─────────────────────────────────────────────────

  async getReferrals(memberId: string) {
    return this.prisma.memberReferral.findMany({
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
      this.prisma.member.findUnique({ where: { id: dto.referrer_member_id } }),
      this.prisma.member.findUnique({ where: { id: dto.referred_member_id } }),
    ]);
    if (!referrer) throw new NotFoundException('Referrer member not found');
    if (!referred) throw new NotFoundException('Referred member not found');

    const existing = await this.prisma.memberReferral.findUnique({
      where: {
        referrer_member_id_referred_member_id: {
          referrer_member_id: dto.referrer_member_id,
          referred_member_id: dto.referred_member_id,
        },
      },
    });
    if (existing) throw new ConflictException('Referral already exists');

    return this.prisma.memberReferral.create({
      data: {
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
    const referral = await this.prisma.memberReferral.findUnique({ where: { id: referralId } });
    if (!referral) throw new NotFoundException('Referral not found');

    return this.prisma.memberReferral.update({
      where: { id: referralId },
      data: {
        reward_status: status,
        ...(status === 'awarded' && { awarded_at: new Date() }),
      },
    });
  }
}
