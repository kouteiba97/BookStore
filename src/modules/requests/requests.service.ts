import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER ?? '213XXXXXXXXX';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeSlug: string, dto: CreateRequestDto) {
    const store = await this.prisma.store.findUnique({
      where: { slug: storeSlug },
    });
    if (!store) throw new NotFoundException('Store not found');

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

    const whatsappUrl = this.buildWhatsappUrl(dto);

    return { id: request.id, whatsappUrl };
  }

  // ── Private ──────────────────────────────────────────────

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
