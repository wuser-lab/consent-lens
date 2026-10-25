export const MAX_REPORT_BYTES = 32 * 1024 * 1024;

export function assertReportSize(text) {
  if (typeof text !== 'string' || text.length > MAX_REPORT_BYTES || new TextEncoder().encode(text).length > MAX_REPORT_BYTES) {
    throw new Error('Report exceeds the 32 MiB limit. Use smaller captures or fewer notes.');
  }
}
