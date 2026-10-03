import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Algerian mobile / landline, written the way people actually type it:
 * 0555123456, 05 55 12 34 56, +213555123456, 00213 555 12 34 56.
 * Spaces, dashes and dots are tolerated and stripped before matching.
 */
const DZ_PHONE = /^(?:(?:\+|00)213|0)[1-9]\d{7,9}$/;

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  lastName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  // Strip the spaces, dashes and dots people type before validating.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s.\-()]/g, '') : value,
  )
  @Matches(DZ_PHONE, {
    message: 'رقم الهاتف غير صحيح',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  wilaya: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(400)
  address: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  bookId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  bookName: string;

  /**
   * Honeypot. Hidden from people by CSS and never focusable, so anything that
   * fills it is an automated form filler. Kept optional and empty-only.
   */
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'rejected' })
  website?: string;
}
