import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError, createErrorResponse } from '@afyapoa/domain-core';
import { IntegrationError } from '@afyapoa/integration-adapters';
import { logger } from '@afyapoa/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal server error occurred.';
    let details: unknown = undefined;

    if (exception instanceof DomainError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof IntegrationError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = HttpStatus[statusCode] || 'HTTP_EXCEPTION';
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        code = (resObj.error as string) || HttpStatus[statusCode] || 'HTTP_EXCEPTION';
        details = resObj.details || (Array.isArray(resObj.message) ? resObj.message : undefined);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      logger.error(`[UNHANDLED_EXCEPTION] ${exception.message}`, exception.stack);
    }

    const errorPayload = createErrorResponse(
      code,
      message,
      statusCode,
      details,
      request.url,
    );

    response.status(statusCode).json(errorPayload);
  }
}
