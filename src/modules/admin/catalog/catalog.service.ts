import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertCatalogDto } from './dto/upsert-catalog.dto';

export type CatalogResource =
  | 'categories'
  | 'authors'
  | 'publishers'
  | 'countries';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private model(resource: CatalogResource) {
    switch (resource) {
      case 'categories':
        return this.prisma.category;
      case 'authors':
        return this.prisma.author;
      case 'publishers':
        return this.prisma.publisher;
      case 'countries':
        return this.prisma.country;
    }
  }

  async list(resource: CatalogResource) {
    const rows = await (this.model(resource) as any).findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { books: true } } },
    });
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: 'description' in r ? r.description : null,
      booksCount: r._count?.books ?? 0,
    }));
  }

  async create(resource: CatalogResource, dto: UpsertCatalogDto) {
    try {
      const data: any = { name: dto.name };
      if (resource === 'categories') data.description = dto.description ?? null;
      return await (this.model(resource) as any).create({ data });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new BadRequestException('A record with this name already exists');
      }
      throw err;
    }
  }

  async update(resource: CatalogResource, id: string, dto: UpsertCatalogDto) {
    const existing = await (this.model(resource) as any).findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Not found');

    try {
      const data: any = { name: dto.name };
      if (resource === 'categories') data.description = dto.description ?? null;
      return await (this.model(resource) as any).update({
        where: { id },
        data,
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new BadRequestException('A record with this name already exists');
      }
      throw err;
    }
  }

  async remove(resource: CatalogResource, id: string) {
    const inUse = await this.prisma.book.count({
      where:
        resource === 'categories'
          ? { categoryId: id }
          : resource === 'authors'
            ? { authorId: id }
            : resource === 'publishers'
              ? { publisherId: id }
              : { countryId: id },
    });

    if (inUse > 0) {
      throw new BadRequestException(
        `Cannot delete: ${inUse} book(s) still reference this record`,
      );
    }

    await (this.model(resource) as any).delete({ where: { id } });
    return { ok: true };
  }
}
