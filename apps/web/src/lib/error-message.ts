function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fromString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return getErrorMessage(JSON.parse(trimmed)) ?? trimmed;
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function getErrorMessage(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null;

  if (typeof value === "string") {
    return fromString(value);
  }

  if (value instanceof Error) {
    return fromString(value.message);
  }

  if (!isRecord(value)) {
    return null;
  }

  const dataMessage = getErrorMessage(value.data, depth + 1);
  if (dataMessage) return dataMessage;

  const directMessage =
    getErrorMessage(value.message, depth + 1) ??
    getErrorMessage(value.statusMessage, depth + 1) ??
    getErrorMessage(value.statusText, depth + 1) ??
    getErrorMessage(value.detail, depth + 1);
  if (directMessage) return directMessage;

  const nestedError = getErrorMessage(value.error, depth + 1);
  if (nestedError) return nestedError;

  return getErrorMessage(value.responseBody, depth + 1);
}

export function formatErrorMessage(value: unknown, fallback: string) {
  return getErrorMessage(value) ?? fallback;
}

export async function getResponseErrorMessage(
  response: Response,
  fallback: string,
) {
  try {
    const text = await response.text();
    return formatErrorMessage(text, fallback);
  } catch {
    return fallback;
  }
}
