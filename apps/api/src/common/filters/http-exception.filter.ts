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
    let details: unknown = undefined;

    if (!(exception instanceof HttpException)) {
      console.error('Unhandled exception:', exception);

      // Handle Supabase/Postgres unique constraint violations
      const exc = exception as Record<string, unknown>;
      if (exc?.code === '23505' || (exc?.message as string)?.includes('duplicate key')) {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE';
        message = 'A record with this information already exists';
      }
      // Fastify plugin errors (rate-limit, body-parser, etc.) carry
      // their own statusCode but aren't HttpException. Surface the real
      // code so a 429 isn't masked as a 500 (which previously hid the
      // real cause of refresh-loop failures during cookie migration).
      else if (typeof exc?.statusCode === 'number' && exc.statusCode >= 400 && exc.statusCode < 600) {
        status = exc.statusCode as number;
        message = (exc.message as string) ?? message;
        code = (exc.code as string) ?? `HTTP_${status}`;
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
        details = resp['details'];

        // Zod-style { details: [{ field, message }] } — fold the
        // first couple of field errors into the user-facing message
        // so a generic "Validation failed" toast becomes useful.
        if (Array.isArray(details) && details.length > 0) {
          const first = details
            .slice(0, 2)
            .map((d) => {
              if (d && typeof d === 'object' && 'field' in d && 'message' in d) {
                const dr = d as { field: string; message: string };
                return `${dr.field}: ${dr.message}`;
              }
              return String(d);
            })
            .join('; ');
          if (first) message = `${message} — ${first}`;
        }
      }
    }

    reply.status(status).send({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }
}
