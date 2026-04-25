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

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsString()
  authorId?: string | null;

  @IsOptional()
  @IsString()
  publisherId?: string | null;

  @IsOptional()
  @IsString()
  countryId?: string | null;

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
