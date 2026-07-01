import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Thin wrapper around Cloudflare R2 (S3-compatible object storage).
 *
 * R2 speaks the S3 API, so we use the AWS SDK pointed at R2's endpoint.
 * If the R2_* env vars are not set, `enabled` is false and callers should
 * fall back to local disk — that keeps local dev working with no R2 account.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client?: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  /** True only when every R2_* var is present. Check this before uploading. */
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    // Trim every value: env vars pasted through dashboards often carry a stray
    // trailing newline/space, and a bad char in the access key breaks the AWS
    // SigV4 Authorization header (ERR_INVALID_CHAR) at request time.
    const accountId = config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    this.bucket = (config.get<string>('R2_BUCKET') ?? '').trim();
    // Strip trailing whitespace and any trailing slash so we join with "/" cleanly.
    this.publicBaseUrl = (config.get<string>('R2_PUBLIC_BASE_URL') ?? '').trim().replace(/\/+$/, '');

    this.enabled = Boolean(
      accountId && accessKeyId && secretAccessKey && this.bucket && this.publicBaseUrl,
    );

    if (!this.enabled) {
      this.logger.warn(
        'R2 not configured — uploads fall back to local disk. Set R2_* env vars to enable.',
      );
      return;
    }

    this.client = new S3Client({
      // R2 ignores region but the SDK requires one; "auto" is the convention.
      region: 'auto',
      // The account-scoped S3 endpoint. The bucket is passed per-request, not here.
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });

    this.logger.log(`R2 storage enabled (bucket: ${this.bucket})`);
  }

  /**
   * Upload bytes to `key` and return the public URL that serves them.
   * `key` is the object path inside the bucket, e.g. "covers/my-book.jpg".
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    this.assertEnabled();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Covers are content-addressed by filename and never change → cache hard.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return this.publicUrl(key);
  }

  /**
   * Return a short-lived presigned PUT URL so a browser can upload a file
   * straight to R2 without streaming it through this API. The client does:
   *   fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': type } })
   */
  async getPresignedPutUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
    this.assertEnabled();
    return getSignedUrl(
      this.client!,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
  }

  /** Public URL for an object key (no network call). */
  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new Error('R2 storage is not configured (missing R2_* env vars).');
    }
  }
}
