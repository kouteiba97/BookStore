import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { INVENTORY_STATUSES } from '../../../common/validation/query';

/** Most books in one archive. Larger selections are split by the admin. */
export const MAX_EXPORT_BOOKS = 200;

/** The same filters as the listing, used to export "everything matching". */
export class SocialFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  publisherId?: string;

  @IsOptional()
  @IsIn(INVENTORY_STATUSES)
  status?: (typeof INVENTORY_STATUSES)[number];
}

/**
 * What to export: explicit ids OR a filter — only identifiers and filters,
 * never book data. Titles, prices and pictures are read from the database.
 */
export class ExportSocialContentDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_EXPORT_BOOKS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  bookIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SocialFilterDto)
  filter?: SocialFilterDto;

  /** Every picture of the book (a series' volumes), not only the cover. */
  @IsOptional()
  @IsBoolean()
  includeGallery?: boolean;
}
