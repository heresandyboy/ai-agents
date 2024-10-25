export function safeStringify(obj: any, maxLength: number = 15000): string {
  try {
    const stringified = JSON.stringify(
      obj,
      (key, value) => {
        // Handle base64 strings specially
        if (key === "base64Image" && typeof value === "string") {
          return value.substring(0, 50) + "... [truncated]";
        }
        return value;
      },
      2
    );

    if (stringified.length > maxLength) {
      return stringified.substring(0, maxLength) + "... [truncated]";
    }
    return stringified;
  } catch (error) {
    return "[Unable to stringify object]";
  }
}
