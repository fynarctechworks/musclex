import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import { MemberErrorCode, ErrorEnvelope } from '../common/envelope';
import { MemberException } from '../common/member-exception';

/**
 * Renders every error thrown from a /member/* controller as the contract's
 * ErrorEnvelope ({ error: { code, message, retryable } }). Applied per-controller
 * via @UseFilters so it never affects admin routes.
 *
 * MemberException carries its own code/retryable. Other HttpExceptions are
 * mapped from status; unknown errors become a generic 500 (message hidden).
 */
@Catch()
export class MemberExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('MemberExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = 'INTERNAL_ERROR';
    let message = 'Something went wrong.';
    let retryable = false;

    if (exception instanceof MemberException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      retryable = exception.retryable;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.codeForStatus(status);
      message = this.extractMessage(exception) ?? code;
      retryable = status >= 500;
      // Server faults dressed as HttpExceptions are still bugs — report them.
      if (status >= 500) Sentry.captureException(exception);
    } else {
      this.logger.error(
        `Unhandled member error: ${
          exception instanceof Error ? exception.stack : String(exception)
        }`,
      );
      // This custom @Catch() handles the error before Sentry's global filter
      // would, so capture it explicitly or unexpected 500s stay invisible.
      // No-op when SENTRY_DSN is unset.
      Sentry.captureException(exception);
    }

    const envelope: ErrorEnvelope = { error: { code, message, retryable } };
    res.status(status).json(envelope);
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return MemberErrorCode.INVALID_TOKEN;
      case HttpStatus.FORBIDDEN:
        return MemberErrorCode.NOT_A_MEMBER;
      case HttpStatus.NOT_FOUND:
        return MemberErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return MemberErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return MemberErrorCode.RATE_LIMITED;
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }

  /** ValidationPipe puts an array of messages on the response body. */
  private extractMessage(exception: HttpException): string | undefined {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const msg = (response as { message?: string | string[] }).message;
      if (Array.isArray(msg)) return msg.join('; ');
      if (typeof msg === 'string') return msg;
    }
    return undefined;
  }
}
