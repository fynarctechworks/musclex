import { HttpException, HttpStatus } from '@nestjs/common';
import { MemberErrorCode } from './envelope';

/**
 * Domain exception for the member BFF. Carries a stable error `code` and a
 * `retryable` flag so MemberExceptionFilter can render the contract's
 * ErrorEnvelope ({ error: { code, message, retryable } }).
 */
export class MemberException extends HttpException {
  constructor(
    readonly code: MemberErrorCode | string,
    message: string,
    status: HttpStatus,
    readonly retryable = false,
  ) {
    super(message, status);
  }

  static notAMember(): MemberException {
    return new MemberException(
      MemberErrorCode.NOT_A_MEMBER,
      'This phone is not linked to any gym membership.',
      HttpStatus.FORBIDDEN,
    );
  }

  static invalidToken(message = 'Invalid or expired token.'): MemberException {
    return new MemberException(
      MemberErrorCode.INVALID_TOKEN,
      message,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static tenantChoiceRequired(): MemberException {
    return new MemberException(
      MemberErrorCode.TENANT_CHOICE_REQUIRED,
      'This phone maps to multiple gyms — a tenant must be selected.',
      HttpStatus.CONFLICT,
    );
  }

  static idempotencyKeyRequired(): MemberException {
    return new MemberException(
      MemberErrorCode.IDEMPOTENCY_KEY_REQUIRED,
      'A valid Idempotency-Key header is required for this request.',
      HttpStatus.BAD_REQUEST,
    );
  }

  static notFound(message = 'Resource not found.'): MemberException {
    return new MemberException(
      MemberErrorCode.RESOURCE_NOT_FOUND,
      message,
      HttpStatus.NOT_FOUND,
    );
  }

  static badRequest(message = 'Invalid request.'): MemberException {
    return new MemberException(
      MemberErrorCode.VALIDATION_FAILED,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }

  static conflict(message: string, retryable = false): MemberException {
    return new MemberException(
      MemberErrorCode.CONFLICT,
      message,
      HttpStatus.CONFLICT,
      retryable,
    );
  }
}
