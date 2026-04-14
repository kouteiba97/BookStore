import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER ?? '213XXXXXXXXX';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ───────────────────────────────────────────────

  async create(storeSlug: string, dto: CreateRequestDto) {
    const store = await this.resolveStore(storeSlug);

    const request = await this.prisma.request.create({
      data: {
        storeId:   store.id,
        firstName: dto.firstName,
        lastName:  dto.lastName,
        phone:     dto.phone,
        wilaya:    dto.wilaya,
        address:   dto.address,
        bookId:    dto.bookId ?? null,
        bookName:  dto.bookName,
        status:    'pending',
      },
    });

    return { id: request.id, whatsappUrl: this.buildWhatsappUrl(dto) };
  }

  // ── Find all (admin) ─────────────────────────────────────

  async findAll(
    storeSlug: string,
    filters: { status?: string; wilaya?: string; search?: string },
  ) {
    const store = await this.resolveStore(storeSlug);

    const { status, wilaya, search } = filters;

    const requests = await this.prisma.request.findMany({
      where: {
        storeId: store.id,
        ...(status ? { status: status as any } : {}),
        ...(wilaya ? { wilaya: { contains: wilaya } } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName:  { contains: search, mode: 'insensitive' } },
                { phone:     { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const counts = await this.prisma.request.groupBy({
      by: ['status'],
      where: { storeId: store.id },
      _count: true,
    });

    return { requests, counts };
  }

  // ── Update status ────────────────────────────────────────

  async updateStatus(storeSlug: string, id: string, status: string) {
    const store = await this.resolveStore(storeSlug);

    const existing = await this.prisma.request.findFirst({
      where: { id, storeId: store.id },
    });
    if (!existing) throw new NotFoundException('Request not found');

    return this.prisma.request.update({
      where: { id },
      data: { status: status as any },
    });
  }

  // ── Helpers ──────────────────────────────────────────────

  private async resolveStore(slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private buildWhatsappUrl(dto: CreateRequestDto): string {
    const message = [
      'السلام عليكم،',
      'أريد طلب كتاب:',
      '',
      `📚 ${dto.bookName}`,
      '',
      `👤 الاسم: ${dto.firstName} ${dto.lastName}`,
      `📞 الهاتف: ${dto.phone}`,
      `📍 الولاية: ${dto.wilaya}`,
      `🏠 العنوان: ${dto.address}`,
    ].join('\n');

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
}
