export type DomainErrorCode =
  | "INVALID_ARGUMENT"
  | "UNKNOWN_PLAN"
  | "STALE_PLAN"
  | "ALREADY_APPLIED"
  | "ALREADY_COMMITTED"
  | "APPROVAL_REQUIRED"
  | "INVALID_APPROVAL"
  | "APPROVAL_EXPIRED"
  | "PLAN_NOT_FEASIBLE"
  | "INSUFFICIENT_INVENTORY"
  | "UNKNOWN_SCENARIO"
  | "NO_ANALYSIS"
  | "NO_REPAIR"
  | "PERSISTENCE_ERROR"
  | "RESET_CONFIRMATION_REQUIRED";

export class ForkcastDomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ForkcastDomainError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
