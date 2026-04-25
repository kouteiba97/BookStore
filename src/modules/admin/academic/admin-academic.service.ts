import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminAcademicService {
  constructor(private readonly prisma: PrismaService) {}

  async tree() {
    const fields = await this.prisma.field.findMany({
      orderBy: { name: 'asc' },
      include: {
        years: {
          orderBy: { name: 'asc' },
          include: {
            subjects: {
              orderBy: { name: 'asc' },
              include: { _count: { select: { books: true } } },
            },
          },
        },
      },
    });
    return fields;
  }

  // ── Fields ─────────────────────────────────────────────

  async createField(name: string) {
    if (!name?.trim()) throw new BadRequestException('Name required');
    try {
      return await this.prisma.field.create({ data: { name: name.trim() } });
    } catch (err: any) {
      if (err.code === 'P2002')
        throw new BadRequestException('Field name already exists');
      throw err;
    }
  }

  async updateField(id: string, name: string) {
    const exists = await this.prisma.field.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Field not found');
    return this.prisma.field.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async deleteField(id: string) {
    await this.prisma.field.delete({ where: { id } });
    return { ok: true };
  }

  // ── Years ──────────────────────────────────────────────

  async createYear(fieldId: string, name: string) {
    if (!name?.trim()) throw new BadRequestException('Name required');
    const field = await this.prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new BadRequestException('Invalid fieldId');
    return this.prisma.academicYear.create({
      data: { fieldId, name: name.trim() },
    });
  }

  async updateYear(id: string, name: string) {
    const exists = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Year not found');
    return this.prisma.academicYear.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async deleteYear(id: string) {
    await this.prisma.academicYear.delete({ where: { id } });
    return { ok: true };
  }

  // ── Subjects ───────────────────────────────────────────

  async createSubject(yearId: string, name: string) {
    if (!name?.trim()) throw new BadRequestException('Name required');
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
    });
    if (!year) throw new BadRequestException('Invalid yearId');
    return this.prisma.subject.create({
      data: { yearId, name: name.trim() },
    });
  }

  async updateSubject(id: string, name: string) {
    const exists = await this.prisma.subject.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Subject not found');
    return this.prisma.subject.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async deleteSubject(id: string) {
    await this.prisma.subject.delete({ where: { id } });
    return { ok: true };
  }
}
