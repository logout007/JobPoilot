// ── Dashboard analytics helpers
// Aggregates job record statistics for the dashboard API.

/**
 * Aggregates job records into summary statistics.
 * Counts items by status into four buckets:
 * - totalApplied: items with status "Applied"
 * - interviews: items with status "Interview"
 * - pending: items with status "Pending"
 * - skipped: items with status "Skipped" or "Error"
 *
 * @param {Array<{ status: string }>} items
 * @returns {{ totalApplied: number, interviews: number, pending: number, skipped: number }}
 */
export function aggregateStats(items) {
  let totalApplied = 0;
  let interviews = 0;
  let pending = 0;
  let skipped = 0;

  for (const item of items) {
    switch (item.status) {
      case 'Applied':
        totalApplied++;
        break;
      case 'Interview':
        interviews++;
        break;
      case 'Pending':
        pending++;
        break;
      case 'Skipped':
      case 'Error':
        skipped++;
        break;
    }
  }

  return { totalApplied, interviews, pending, skipped };
}

/**
 * Builds a dashboard API response object.
 *
 * @param {Array<object>} items - Job records.
 * @param {{ totalApplied: number, interviews: number, pending: number, skipped: number }} stats
 * @returns {{ items: Array<object>, stats: object, lastUpdated: string }}
 */
export function buildResponse(items, stats) {
  return {
    items,
    stats,
    lastUpdated: new Date().toISOString(),
  };
}
