/**
 * Structured JSON logging. Workers Logs indexes JSON fields, so events can be filtered by `event`, `channel`, etc.
 * Never log submitted personal data (names, emails, messages) or secret values such as webhook URLs.
 */
type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Summarizes an unknown thrown value for logging, including the error code Email Sending reports. */
export function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: String(error) };
  const code = (error as { code?: unknown }).code;
  return { error: error.message, errorName: error.name, ...(code === undefined ? {} : { errorCode: code }) };
}
