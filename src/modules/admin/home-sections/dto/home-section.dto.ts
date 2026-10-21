import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MAX_SHELF_BOOKS } from '../../../../common/home/home-layout';

export class CreateHomeSectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  subtitle?: string | null;
}

export class UpdateHomeSectionDto {
  /** Empty or null on a built-in block → back to its default title. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  subtitle?: string | null;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class ReorderHomeSectionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];
}

export class SetShelfBooksDto {
  @IsArray()
  @ArrayMaxSize(MAX_SHELF_BOOKS)
  @IsString({ each: true })
  bookIds: string[];
}
