import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  MaxLength,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ORDER_STATUSES } from '../../../../common/validation/query';

export const SALE_CHANNELS = ['online', 'shop', 'import'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'cod', 'other'] as const;

export class OrderItemInputDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  // Optional override; otherwise we use the book's current price
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  unitPrice?: number;
}

export class UpsertOrderDto {
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() wilaya: string;
  @IsString() @IsNotEmpty() address: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  shippingCost?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsIn(SALE_CHANNELS)
  channel?: (typeof SALE_CHANNELS)[number];

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?:
    | 'pending'
    | 'confirmed'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
}

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
}

export class ConvertRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  shippingCost?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

/** A sale at the counter: books and payment; the customer is optional. */
export class CounterSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
