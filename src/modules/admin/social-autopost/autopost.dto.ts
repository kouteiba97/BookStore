import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ConnectDto {
  /** Business Manager system-user token (never-expiring). */
  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  token!: string;

  /** Which Page, when the token can post to several. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  pageId?: string;
}

export class ChannelDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Clear an automatic pause after fixing the problem. */
  @IsOptional()
  @IsBoolean()
  resume?: boolean;
}

export const POST_ACTIONS = ['approve', 'skip', 'replace'] as const;

export class UpdatePostDto {
  @IsOptional()
  @IsIn(POST_ACTIONS)
  action?: (typeof POST_ACTIONS)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  caption?: string;
}

export class CalendarDto {
  @IsObject()
  calendar!: Record<string, unknown>;
}

export class SettingsDto {
  /** 0 = publish without waiting for the owner. */
  @IsInt()
  @Min(0)
  @Max(168)
  autoApproveHours!: number;
}
