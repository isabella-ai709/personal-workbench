import type { ApiError, ApiErrorCode } from "./contracts";

export class WorkbenchError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WorkbenchError";
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof WorkbenchError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "The workbench could not complete this request.",
    },
  };
}
