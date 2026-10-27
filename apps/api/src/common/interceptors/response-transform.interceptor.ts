import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, createSuccessResponse, PaginationMeta } from '@afyapoa/domain-core';

interface PaginatedData<T = unknown> {
  items: T[];
  meta: PaginationMeta;
}

function isPaginatedData(data: unknown): data is PaginatedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'items' in data &&
    'meta' in data
  );
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    // Bypass health check endpoints, raw swagger, and FHIR REST gateway
    if (
      request.url.startsWith('/health') ||
      request.url.startsWith('/api/docs') ||
      request.url.startsWith('/api/v1/fhir')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {

        // If data is already an envelope with success: true, return as-is
        if (typeof data === 'object' && data !== null && 'success' in data) {
          return data;
        }

        if (isPaginatedData(data)) {
          return createSuccessResponse(data.items as unknown as T, data.meta);
        }

        return createSuccessResponse(data);
      }),
    );
  }
}
