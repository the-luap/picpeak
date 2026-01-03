/**
 * Shared Parser Utilities for Frontend
 * Pure functions for parsing and transforming input values
 *
 * @module utils/parsers
 */

/**
 * Parse any input value to boolean with configurable default
 * Handles: boolean, number, string representations
 *
 * @param value - Input value to parse
 * @param defaultValue - Default if value is undefined/null
 * @returns boolean result
 *
 * @example
 * toBoolean(true) // true
 * toBoolean('false') // false
 * toBoolean('1') // true
 * toBoolean(0) // false
 * toBoolean(undefined, false) // false
 */
export const toBoolean = (value: unknown, defaultValue = false): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return defaultValue;
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return defaultValue;
};

/**
 * Parse numeric input with validation and optional bounds
 *
 * @param value - Input value to parse
 * @param defaultValue - Default if invalid
 * @param options - Bounds options
 * @returns number result
 *
 * @example
 * toNumber('42', 0) // 42
 * toNumber('abc', 10) // 10
 * toNumber(5, 0, { min: 10 }) // 10
 */
export const toNumber = (
  value: unknown,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  let result = parsed;
  if (options?.min !== undefined && result < options.min) result = options.min;
  if (options?.max !== undefined && result > options.max) result = options.max;

  return result;
};

/**
 * Parse string input with trimming and null handling
 *
 * @param value - Input value
 * @param defaultValue - Default if empty
 * @returns string or null
 *
 * @example
 * toString('  hello  ') // 'hello'
 * toString('') // null
 * toString(null, 'default') // 'default'
 */
export const toString = (value: unknown, defaultValue: string | null = null): string | null => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || defaultValue;
  }
  return String(value);
};

/**
 * Parse JSON string safely
 *
 * @param value - JSON string or already parsed value
 * @param defaultValue - Default if parsing fails
 * @returns parsed value or default
 */
export const parseJson = <T>(value: unknown, defaultValue: T): T => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== 'string') {
    return value as T;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
};

/**
 * Parse date input to Date object
 *
 * @param value - Date string, Date object, or timestamp
 * @returns Date object or null if invalid
 */
export const toDate = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value as string | number);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Parse array input (handles JSON strings and arrays)
 *
 * @param value - Array or JSON string
 * @param defaultValue - Default if invalid
 * @returns array result
 */
export const toArray = <T>(value: unknown, defaultValue: T[] = []): T[] => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      // Try comma-separated for string arrays
      return value.split(',').map(s => s.trim()).filter(Boolean) as T[];
    }
  }
  return defaultValue;
};

// Re-export with alternative names for backwards compatibility
export const parseBooleanInput = toBoolean;
export const parseNumberInput = toNumber;
export const parseStringInput = toString;
