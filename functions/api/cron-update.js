export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const token = searchParams.get('token');
  
  // Authenticate token using environment variable or a secure fallback
  const expectedToken = context.env.CRON_SECRET || 'kalender_cron_secret';
  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const results = [];
  const startYear = 2011;
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + 2;

  let cache;
  try {
    cache = caches.default;
  } catch (e) {
    console.warn("Cache API not available during cron run:", e);
  }

  for (let year = startYear; year <= endYear; year++) {
    try {
      // 1. Fetch holidays from public API
      const response = await fetch(`https://libur.deno.dev/api?year=${year}`);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const resJson = await response.json();
      if (!resJson || !Array.isArray(resJson)) {
        throw new Error("Invalid API response format");
      }

      // Map API response to our app format
      const mappedData = resJson.map(h => ({
        date: h.date,
        name: h.name,
        is_leave_together: !h.is_national_holiday
      }));
      
      // Sort mappedData by date and name lexicographically to match the order of DB queries
      mappedData.sort((a, b) => {
        if (a.date !== b.date) {
          return a.date < b.date ? -1 : 1;
        }
        return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
      });
      
      const newValue = JSON.stringify(mappedData);

      // 2. Fetch existing holidays from D1 for that year
      const { results: existingRows } = await context.env.DB.prepare(
        "SELECT date, name, is_leave_together FROM holidays WHERE date LIKE ? ORDER BY date ASC, name ASC"
      ).bind(`${year}-%`).all();

      // Normalize is_leave_together to boolean for comparison
      const normalizedExisting = existingRows ? existingRows.map(r => ({
        date: r.date,
        name: r.name,
        is_leave_together: r.is_leave_together === 1 || r.is_leave_together === true
      })) : [];

      // 3. Compare and update only if there are changes (D1 Write Optimization)
      const existingString = JSON.stringify(normalizedExisting);
      if (existingString === newValue) {
        results.push({ year, status: "skipped", message: "Data is already identical, D1 write skipped" });
      } else {
        // Write new data to D1
        // We delete first to clean up any removed holidays for that year
        const deleteStmt = context.env.DB.prepare("DELETE FROM holidays WHERE date LIKE ?").bind(`${year}-%`);
        const insertStmt = context.env.DB.prepare("INSERT OR REPLACE INTO holidays (date, name, is_leave_together) VALUES (?, ?, ?)");
        const stmts = [
          deleteStmt,
          ...mappedData.map(h => insertStmt.bind(h.date, h.name, h.is_leave_together ? 1 : 0))
        ];
        
        await context.env.DB.batch(stmts);
        
        // Purge Edge Cache for /api/holidays?year=YYYY
        if (cache) {
          try {
            const holidaysUrl = new URL(context.request.url);
            holidaysUrl.pathname = "/api/holidays";
            holidaysUrl.search = `?year=${year}`;
            await cache.delete(holidaysUrl.toString());
            results.push({ year, status: "updated", message: "D1 updated and edge cache purged" });
          } catch (cacheDeleteError) {
            results.push({ year, status: "updated", message: `D1 updated, cache purge failed: ${cacheDeleteError.message}` });
          }
        } else {
          results.push({ year, status: "updated", message: "D1 updated, cache not purged (no cache API)" });
        }
      }
    } catch (err) {
      results.push({ year, status: "failed", message: err.message });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
