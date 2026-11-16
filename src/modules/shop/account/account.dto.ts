import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DZ_PHONE, stripPhone } from '../../../common/orders/order-public';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const phone = ({ value }: { value: unknown }) => (typeof value === 'string' ? stripPhone(value) : value);
/** Empty text means "no value" for optional fields. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** 8–72 characters (bcrypt-era ceiling kept so long pastes stay predictable). */
const PASSWORD_RULES = [
  MinLength(8, { message: 'كلمة المرور 8 أحرف على الأقل' }),
  MaxLength(72, { message: 'كلمة المرور طويلة جدًا' }),
];
function Password(): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    for (const rule of PASSWORD_RULES) rule(target, key);
  };
}

export class RegisterDto {
  @Transform(trim) @IsString() @IsNotEmpty({ message: 'الاسم مطلوب' }) @MaxLength(60)
  firstName: string;

  @Transform(trim) @IsString() @IsNotEmpty({ message: 'اللقب مطلوب' }) @MaxLength(60)
  lastName: string;

  @Transform(phone) @IsString() @Matches(DZ_PHONE, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @Password()
  password: string;

  @IsOptional() @Transform(emptyToNull) @IsEmail({}, { message: 'البريد الإلكتروني غير صحيح' }) @MaxLength(120)
  email?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60)
  wilaya?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(400)
  address?: string | null;
}

export class LoginDto {
  @Transform(phone) @IsString() @Matches(DZ_PHONE, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @IsString() @IsNotEmpty({ message: 'أدخل كلمة المرور' }) @MaxLength(200)
  password: string;
}

export class UpdateProfileDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty({ message: 'الاسم مطلوب' }) @MaxLength(60)
  firstName?: string;

  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty({ message: 'اللقب مطلوب' }) @MaxLength(60)
  lastName?: string;

  @IsOptional() @Transform(emptyToNull) @IsEmail({}, { message: 'البريد الإلكتروني غير صحيح' }) @MaxLength(120)
  email?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60)
  wilaya?: string | null;

  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(400)
  address?: string | null;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty({ message: 'أدخل كلمة المرور الحالية' }) @MaxLength(200)
  current: string;

  @Password()
  next: string;
}

export class ResetPasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  token: string;

  @Password()
  password: string;
}
