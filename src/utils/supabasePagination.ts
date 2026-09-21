/**
 * Utility to fetch all rows for a Supabase PostgREST query by handling
 * PostgREST's default 1000-row response limit through automatic pagination.
 */
export async function fetchAllPaginated<T = any>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  let allRows: T[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const from = page * pageSize;
    const to = (page + 1) * pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error || !data || data.length === 0) {
      if (error) console.error("Error in fetchAllPaginated:", error);
      break;
    }

    allRows = allRows.concat(data);

    if (data.length < pageSize) {
      break;
    }

    page++;
  }

  return allRows;
}
