import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { INVENTORY_STATUSES } from '../../../common/validation/query';
import { DataImportService, ImportOptions } from './data-import.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

class ImportOptionsDto implements ImportOptions {
  @IsString()
  @MaxLength(100)
  sheet: string;

  @IsInt()
  @Min(0)
  @Max(10_000)
  headerRow: number;

  /** { field: columnIndex } — fields and indexes are checked by the service. */
  @IsObject()
  mapping: ImportOptions['mapping'];

  @IsIn(['update', 'skip'])
  existing: 'update' | 'skip';

  @IsIn(['set', 'add'])
  stockMode: 'set' | 'add';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultCategory?: string | null;

  @IsIn(INVENTORY_STATUSES)
  defaultStatus: (typeof INVENTORY_STATUSES)[number];
}

/**
 * Spreadsheet import wizard: upload → analyse (columns recognised) → preview
 * (what will happen, row by row) → commit; plus history, undo, a template and
 * a data-quality summary.
 */
@UseGuards(AdminAuthGuard)
@Controller('v1/admin')
export class DataImportController {
  constructor(private readonly service: DataImportService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('data-import/analyze')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }))
  analyze(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('لم يتم إرسال أي ملف (الحقل "file").');
    return this.service.analyze(file);
  }

  @Post('data-import/:sessionId/preview')
  preview(@Param('sessionId', ParseUUIDPipe) id: string, @Body() dto: ImportOptionsDto) {
    return this.service.preview(id, dto);
  }

  @Post('data-import/:sessionId/report')
  async report(
    @Param('sessionId', ParseUUIDPipe) id: string,
    @Body() dto: ImportOptionsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, fileName } = await this.service.issuesReport(id, dto);
    return xlsx(res, buffer, fileName);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('data-import/:sessionId/commit')
  commit(@Param('sessionId', ParseUUIDPipe) id: string, @Body() dto: ImportOptionsDto) {
    return this.service.commit(id, dto);
  }

  @Get('data-import/history')
  history() {
    return this.service.history();
  }

  @Post('data-import/jobs/:jobId/undo')
  undo(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.service.undo(jobId);
  }

  @Get('data-import/template')
  template(@Res({ passthrough: true }) res: Response) {
    return xlsx(res, this.service.template(), 'books-template.xlsx');
  }

  @Get('data-quality')
  quality() {
    return this.service.quality();
  }
}

/** Send an .xlsx download. The file name is ASCII-safe plus an RFC 5987 UTF-8 form. */
export function xlsx(res: Response, buffer: Buffer, fileName: string): StreamableFile {
  const ascii = fileName.replace(/[^\w.\-]+/g, '_') || 'export.xlsx';
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'no-store',
  });
  return new StreamableFile(buffer);
}
