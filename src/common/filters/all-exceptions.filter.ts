import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { STATUS_CODES } from 'http';

const STATUS_TEXT: Record<number, string> = STATUS_CODES as Record<number, string>;

/**
 * Catches everything that bubbles out of a request and returns a consistent
 * JSON envelope. HttpExceptions keep their status/message; anything else is
 * logged with a stack trace and reported as a generic 500 so internal details
 * (stack traces, DB errors) never leak to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Pull the message/error out of HttpException; hide details otherwise.
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    if (isHttp) {
      const body = exception.getResponse();
      // Default the label from the status (e.g. a throttler 429 carries only a
      // string body and was being labelled "Internal Server Error").
      error = STATUS_TEXT[status] ?? exception.name;
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        message = (body as any).message ?? message;
        error = (body as any).error ?? error;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Server-side faults: log the full error so monitoring/Sentry can pick
      // it up. Client errors (4xx) are expected and stay quiet.
      this.logger.error(
        `${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
