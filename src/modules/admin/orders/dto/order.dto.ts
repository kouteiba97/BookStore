import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

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
  @IsString()
  status?:
    | 'pending'
    | 'confirmed'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
}

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
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
