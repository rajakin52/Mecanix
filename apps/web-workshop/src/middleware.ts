import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except Next.js internals, API routes, and static files.
  // Without this, bare paths like `/login` skip the locale-prefix redirect
  // and get routed as `[locale=login]`, breaking the page.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
