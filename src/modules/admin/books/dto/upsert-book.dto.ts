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

  // Category stays single-valued. The form may send either an existing id OR a
  // free-text name; when only a name is given the service finds-or-creates it,
  // falling back to "غير مصنف" when neither is provided.
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  categoryName?: string | null;

  // ── Authors (many) ────────────────────────────────────────────────
  // Order is meaningful: index 0 is the primary author. Ids and names are
  // merged, ids first; names are found-or-created by the service.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authorNames?: string[];

  // ── Publishers (many) ─────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  publisherIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  publisherNames?: string[];

  // ── Deprecated singular aliases ───────────────────────────────────
  // Kept so existing clients (the Flutter apps, Quick Add, CSV import) keep
  // working unchanged. The service folds these into the arrays above.
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

  /// Public blurb about the work, shown under "عن الكتاب".
  @IsOptional()
  @IsString()
  description?: string | null;

  /// Concrete extra detail the title cannot carry (edition, volumes, binding,
  /// condition…), shown under "معلومات إضافية".
  @IsOptional()
  @IsString()
  notes?: string | null;

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

  // ── Academic placement ────────────────────────────────────────────
  // A book may be attached at any depth. Attaching it to a speciality alone
  // is valid and is what makes it show up under that speciality.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  yearIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];
}
