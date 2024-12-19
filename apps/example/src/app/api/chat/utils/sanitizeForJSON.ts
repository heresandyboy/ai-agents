/**
 * Recursively sanitizes JSON to handle Dates, arrays, objects, etc.
 */
export function sanitizeForJSON<T>(value: T): T | string {
    if (value instanceof Date) return value.toISOString() as unknown as T;
    if (Array.isArray(value)) {
        return value.map(sanitizeForJSON) as unknown as T;
    }
    if (value !== null && typeof value === "object") {
        const sanitizedObj = {} as Record<string, unknown>;
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                sanitizedObj[key] = sanitizeForJSON(value[key]);
            }
        }
        return sanitizedObj as T;
    }
    return value;
} 