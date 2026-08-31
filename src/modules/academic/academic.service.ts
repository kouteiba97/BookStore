import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { bookInclude, serializeBooks } from '../../common/utils/book-serializer';

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

  /**
   * Every book that belongs to a speciality, at ANY depth: attached directly to
   * the speciality, to one of its years, or to one of its subjects.
   *
   * This is what makes a book assigned to e.g. "شريعة" actually appear under
   * that speciality. Previously a book could only ever be attached to a
   * Subject, so a speciality-level assignment resolved to nothing.
   */
  private booksInFieldWhere(storeId: string, fieldId: string) {
    return {
      storeId,
      OR: [
        { fields: { some: { fieldId } } },
        { years: { some: { year: { fieldId } } } },
        { subjects: { some: { subject: { year: { fieldId } } } } },
      ],
    };
  }

  private booksInYearWhere(storeId: string, yearId: string) {
    return {
      storeId,
      OR: [
        { years: { some: { yearId } } },
        { subjects: { some: { subject: { yearId } } } },
      ],
    };
  }

  async getFields(storeSlug: string) {
    const store = await this.resolveStore(storeSlug);

    const fields = await this.prisma.field.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Attach an aggregated book count so the UI can tell the shopper up front
    // which specialities actually have stock, instead of leading them into an
    // empty drill-down.
    const counts = await Promise.all(
      fields.map((f) =>
        this.prisma.book.count({
          where: this.booksInFieldWhere(store.id, f.id) as any,
        }),
      ),
    );

    return fields.map((f, i) => ({ ...f, bookCount: counts[i] }));
  }

  async getYears(storeSlug: string, fieldId: string) {
    const store = await this.resolveStore(storeSlug);

    const field = await this.prisma.field.findUnique({
      where: { id: fieldId },
    });
    if (!field) throw new NotFoundException('Field not found');

    const years = await this.prisma.academicYear.findMany({
      where: { fieldId },
      select: { id: true, name: true, fieldId: true },
      orderBy: { name: 'asc' },
    });

    const counts = await Promise.all(
      years.map((y) =>
        this.prisma.book.count({
          where: this.booksInYearWhere(store.id, y.id) as any,
        }),
      ),
    );

    return years.map((y, i) => ({ ...y, bookCount: counts[i] }));
  }

  async getSubjects(storeSlug: string, yearId: string) {
    const store = await this.resolveStore(storeSlug);

    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    const subjects = await this.prisma.subject.findMany({
      where: { yearId },
      select: { id: true, name: true, yearId: true },
      orderBy: { name: 'asc' },
    });

    const counts = await Promise.all(
      subjects.map((s) =>
        this.prisma.book.count({
          where: {
            storeId: store.id,
            subjects: { some: { subjectId: s.id } },
          },
        }),
      ),
    );

    return subjects.map((s, i) => ({ ...s, bookCount: counts[i] }));
  }

  /** All books under a speciality, aggregated across years and subjects. */
  async getBooksByField(storeSlug: string, fieldId: string) {
    const store = await this.resolveStore(storeSlug);

    const field = await this.prisma.field.findUnique({ where: { id: fieldId } });
    if (!field) throw new NotFoundException('Field not found');

    const books = await this.prisma.book.findMany({
      where: this.booksInFieldWhere(store.id, fieldId) as any,
      include: bookInclude as any,
      orderBy: { title: 'asc' },
    });

    return serializeBooks(books);
  }

  /** All books under a study year, aggregated across its subjects. */
  async getBooksByYear(storeSlug: string, yearId: string) {
    const store = await this.resolveStore(storeSlug);

    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    const books = await this.prisma.book.findMany({
      where: this.booksInYearWhere(store.id, yearId) as any,
      include: bookInclude as any,
      orderBy: { title: 'asc' },
    });

    return serializeBooks(books);
  }

  async getBooksBySubject(storeSlug: string, subjectId: string) {
    const store = await this.resolveStore(storeSlug);

    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const books = await this.prisma.book.findMany({
      where: {
        storeId: store.id,
        subjects: { some: { subjectId } },
      },
      include: bookInclude as any,
      orderBy: { title: 'asc' },
    });

    return serializeBooks(books);
  }
}
