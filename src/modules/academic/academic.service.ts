import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const bookInclude = {
  inventory: true,
  category: true,
  author: true,
  publisher: true,
};

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveStore(storeSlug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug: storeSlug },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async getFields(storeSlug: string) {
    await this.resolveStore(storeSlug);

    return this.prisma.field.findMany({
      select: { id: true, name: true },
    });
  }

  async getYears(storeSlug: string, fieldId: string) {
    await this.resolveStore(storeSlug);

    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
    });
    if (!field) throw new NotFoundException('Field not found');

    return this.prisma.academicYear.findMany({
      where: { fieldId },
      select: { id: true, name: true, fieldId: true },
    });
  }

  async getSubjects(storeSlug: string, yearId: string) {
    await this.resolveStore(storeSlug);

    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    return this.prisma.subject.findMany({
      where: { yearId },
      select: { id: true, name: true, yearId: true },
    });
  }

  async getBooksBySubject(storeSlug: string, subjectId: string) {
    const store = await this.resolveStore(storeSlug);

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    return this.prisma.book.findMany({
      where: {
        storeId: store.id,
        subjects: { some: { subjectId } },
      },
      include: bookInclude,
    });
  }
}
