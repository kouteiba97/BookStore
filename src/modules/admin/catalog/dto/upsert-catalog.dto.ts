import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertCatalogDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
