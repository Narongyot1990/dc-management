/**
 * Count items by status field
 * @param items - Array of items with a status field
 * @param statusKeys - Status values to count
 * @returns Object with counts per status + total
 */
export function countByStatus<T extends { status: string }>(
  items: T[],
  statusKeys: string[]
): Record<string, number> & { total: number } {
  const result: Record<string, number> = {};
  statusKeys.forEach(key => {
    result[key] = items.filter(item => item.status === key).length;
  });
  return { ...result, total: items.length } as Record<string, number> & { total: number };
}
