export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  DB_NOT_FOUND: "DB_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class CliError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
