import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DZ_PHONE, stripPhone } from '../../../common/orders/order-public';

/** Most lines one checkout may hold, and most copies of one book. */
export const MAX_LINES = 20;
export const MAX_QTY = 10;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ShopOrderItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  bookId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QTY)
  quantity: number;
}

/** Shared by checkout and the account profile. */
export class CustomerFieldsDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MaxLength(60)
  firstName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'اللقب مطلوب' })
  @MaxLength(60)
  lastName: string;

  @Transform(({ value }) => (typeof value === 'string' ? stripPhone(value) : value))
  @IsString()
  @Matches(DZ_PHONE, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'الولاية مطلوبة' })
  @MaxLength(60)
  wilaya: string;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'العنوان قصير جدًا (10 أحرف على الأقل)' })
  @MaxLength(400)
  address: string;
}

export class CreateShopOrderDto extends CustomerFieldsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'السلة فارغة' })
  @ArrayMaxSize(MAX_LINES, { message: `لا يمكن طلب أكثر من ${MAX_LINES} كتابًا مختلفًا في طلب واحد` })
  @ValidateNested({ each: true })
  @Type(() => ShopOrderItemDto)
  items: ShopOrderItemDto[];

  /** Optional word from the customer ("the blue edition, please"). */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Honeypot: hidden from people, filled only by bots. Must stay empty. */
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'rejected' })
  website?: string;
}

export class QuoteDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  bookIds: string[];
}
