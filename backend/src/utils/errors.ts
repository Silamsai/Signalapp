export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function validationError(message: string, details?: unknown) {
  return new AppError(400, message, "validation_error", details);
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(401, message, "unauthorized");
}

export function forbidden(message = "Forbidden") {
  return new AppError(403, message, "forbidden");
}

export function notFound(message = "Not found") {
  return new AppError(404, message, "not_found");
}

export function conflict(message: string, details?: unknown) {
  return new AppError(409, message, "conflict", details);
}

export function rateLimited(message = "Rate limit exceeded") {
  return new AppError(429, message, "rate_limited");
}

export function providerNotConfigured(provider = "exa") {
  return new AppError(
    503,
    `${provider} provider is not configured. Set EXA_API_KEY in backend/.env`,
    "provider_not_configured",
  );
}
