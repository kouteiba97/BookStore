import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storeSlug: string, dto: CreateRequestDto) {
    const store = await this.prisma.store.findUnique({
      where: { slug: storeSlug },
    });

    if (!store) throw new NotFoundException('Store not found');

    return this.prisma.request.create({
      data: {
        bookName: dto.bookName,
        userPhone: dto.userPhone,
        userType: dto.userType,
        status: 'pending',
        storeId: store.id,
      },
    });
  }
}
