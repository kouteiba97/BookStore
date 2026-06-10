import {
  BadRequestException,
  Controller,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { StorageService } from '../../storage/storage.service';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB — phone photos
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Cover-photo upload. The browser sends the photo as multipart; we push it to
 * R2 server-side (no presigned URL / no bucket CORS needed) and return the
 * public URL to store on the book.
 */
@UseGuards(AdminAuthGuard)
@Controller('v1/admin/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('cover')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('يُقبل فقط JPG أو PNG أو WEBP'), false);
      },
    }),
  )
  async uploadCover(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('لم يتم إرسال أي ملف (الحقل "file").');
    }
    if (!this.storage.enabled) {
      throw new ServiceUnavailableException(
        'تخزين R2 غير مُهيّأ على الخادم. تحقق من متغيرات R2_*.',
      );
    }

    const ext = (extname(file.originalname) || '.jpg').toLowerCase();
    const key = `covers/${randomUUID()}${ext}`;
    const url = await this.storage.upload(key, file.buffer, file.mimetype);

    return { url, key };
  }
}
