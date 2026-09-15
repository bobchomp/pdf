/**
 * An error whose message is safe to show a caller as-is — a deliberate, friendly message
 * written by app code (e.g. "A user with this email already exists"), as opposed to a raw
 * error surfacing from the database/infrastructure layer, which might include internal
 * details (SQL text, connection info) that shouldn't reach the client.
 */
export class AppError extends Error {}
