import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_METHODS } from '../orders/dto/order.dto';

export const EXPENSE_CATEGORIES = ['rent', 'salaries', 'transport', 'utilities', 'marketing', 'supplies', 'taxes', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  rent: 'إيجار',
  salaries: 'أجور ورواتب',
  transport: 'نقل وتوصيل',
  utilities: 'كهرباء وماء وهاتف وإنترنت',
  marketing: 'إشهار وتسويق',
  supplies: 'لوازم وتجهيزات',
  taxes: 'ضرائب ورسوم',
  other: 'أخرى',
};

export class SupplierDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(160) email?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class PurchaseItemDto {
  /** An existing book… */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bookId?: string;

  /** …or a title: matched to a book, or a new book is created. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost: number;

  /** Optional new selling price for the book. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salePrice?: number;
}

export class PurchaseDto {
  @IsOptional() @IsString() @MaxLength(64) supplierId?: string | null;
  /** Free text: found or created. */
  @IsOptional() @IsString() @MaxLength(160) supplierName?: string | null;

  @IsOptional() @IsString() @MaxLength(80) reference?: string | null;
  @IsOptional() @IsISO8601() date?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) shippingCost?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) paidAmount?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;

  /** Add the books to stock (default yes). */
  @IsOptional() @IsBoolean() addToStock?: boolean;
  /** Set each book's purchase price to this line's cost (default yes). */
  @IsOptional() @IsBoolean() updateCostPrice?: boolean;
}

export class PaymentDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paidAmount: number;
}

export class ExpenseDto {
  @IsIn(EXPENSE_CATEGORIES)
  category: ExpenseCategory;

  @IsNumber()
  @Min(0.01)
  @Max(999_999_999)
  @Type(() => Number)
  amount: number;

  @IsOptional() @IsISO8601() date?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: (typeof PAYMENT_METHODS)[number] | null;
}

export class StoreProfileDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(300) address?: string | null;
  @IsOptional() @IsString() @MaxLength(160) email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) rc?: string | null;
  @IsOptional() @IsString() @MaxLength(40) nif?: string | null;
  @IsOptional() @IsString() @MaxLength(40) nis?: string | null;
  @IsOptional() @IsString() @MaxLength(40) art?: string | null;
  @IsOptional() @IsString() @MaxLength(500) invoiceFooter?: string | null;
}
