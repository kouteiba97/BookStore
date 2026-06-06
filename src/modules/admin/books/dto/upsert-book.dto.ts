import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryDto {
  @IsString()
  @IsNotEmpty()
  status: 'available' | 'on_request' | 'rare';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number | null;
}

export class UpsertBookDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // For each reference (category/author/publisher/country) the form may send
  // either an existing *Id OR a free-text *Name. When only a name is given, the
  // service finds-or-creates the row by name. Category additionally falls back
  // to "غير مصنف" when nothing is provided.
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  categoryName?: string | null;

  @IsOptional()
  @IsString()
  authorId?: string | null;

  @IsOptional()
  @IsString()
  authorName?: string | null;

  @IsOptional()
  @IsString()
  publisherId?: string | null;

  @IsOptional()
  @IsString()
  publisherName?: string | null;

  @IsOptional()
  @IsString()
  countryId?: string | null;

  @IsOptional()
  @IsString()
  countryName?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  year?: number | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  price?: number | null;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  inventory?: InventoryDto | null;

  @IsOptional()
  @IsArray()
  subjectIds?: string[];
}
