import 'server-only';

/**
 * A failure the client is allowed to see.
 *
 * `code` is a stable machine string the UI can branch on (e.g. render an inline
 * "verify your email" prompt for EMAIL_NOT_VERIFIED); `message` is human text.
 * Anything that is not an AuthError is an internal fault and must never have its
 * message leaked — the route wrapper turns those into a generic 500.
 */
export class AuthError extends Error {
  readonly status: number;
  readonly code: string;

  // Fields assigned in the body rather than as constructor parameter properties:
  // the project's tsconfig sets `erasableSyntaxOnly`, which forbids the shorthand
  // because it emits real code rather than being a pure type annotation.
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code: string, m: string) => new AuthError(400, code, m);
export const unauthorized = (code: string, m: string) => new AuthError(401, code, m);
export const forbidden = (code: string, m: string) => new AuthError(403, code, m);
export const conflict = (code: string, m: string) => new AuthError(409, code, m);
export const tooMany = (m: string) => new AuthError(429, 'RATE_LIMITED', m);
