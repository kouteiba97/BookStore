import { IsOptional, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  wilaya: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  address: string;

  @IsString()
  @IsOptional()
  bookId?: string;

  @IsString()
  @IsNotEmpty()
  bookName: string;
}
