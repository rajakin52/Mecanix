import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (!(exception instanceof HttpException)) {
      console.error('Unhandled exception:', exception);

      // Handle Supabase/Postgres unique constraint violations
      const exc = exception as Record<string, unknown>;
      if (exc?.code === '23505' || (exc?.message as string)?.includes('duplicate key')) {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE';
        message = 'A record with this information already exists';
      }
    }

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const resp = response as Record<string, unknown>;
        message = (resp['message'] as string) ?? message;
        code = (resp['error'] as string) ?? code;
      }
    }

    reply.status(status).send({
      success: false,
      error: {
        code,
        message,
      },
    });
  }
}
