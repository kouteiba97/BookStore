import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@UseGuards(AdminAuthGuard)
@Controller('v1/:storeSlug/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('books')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowed.includes(file.mimetype) || /\.(csv|xlsx|xls)$/i.test(file.originalname)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV and Excel files are accepted'), false);
        }
      },
    }),
  )
  async importBooks(
    @Param('storeSlug') storeSlug: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send a CSV or XLSX file as "file" field.');
    }

    return this.importService.importBooks(storeSlug, file);
  }
}
