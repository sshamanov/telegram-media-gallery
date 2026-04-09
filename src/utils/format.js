/**
 * Utility functions for formatting values.
 * Extracted from src-reference/main.js lines 1766–1786.
 */

/**
 * Format byte count into a human-readable string with one decimal place.
 * @param {number} bytes
 * @returns {string} e.g. "1.4 MB"
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format byte count without decimal places.
 * @param {number} bytes
 * @returns {string} e.g. "1 MB"
 */
export function formatBytesNoDecimal(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}

/**
 * Format a duration in seconds as M:SS.
 * @param {number} seconds
 * @returns {string} e.g. "3:07"
 */
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
