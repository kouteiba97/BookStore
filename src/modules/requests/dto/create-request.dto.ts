import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  bookName: string;

  @IsString()
  @IsNotEmpty()
  userPhone: string;

  @IsString()
  @IsOptional()
  userType?: string;
}
