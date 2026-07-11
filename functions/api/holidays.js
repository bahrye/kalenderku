export async function onRequest(context) {
  let cache;
  try {
    cache = caches.default;
  } catch (e) {
    console.warn("Cache API not available:", e);
  }

  const cacheKey = context.request.url;

  // Try to match in cache first to prevent KV reads
  if (cache) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const newHeaders = new Headers(cachedResponse.headers);
        newHeaders.set("X-Cache", "HIT-Edge");
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: newHeaders
        });
      }
    } catch (cacheError) {
      console.warn("Cache match failed, reading from KV directly:", cacheError);
    }
  }

  // Cache miss
  const { searchParams } = new URL(context.request.url);
  const year = searchParams.get('year');
  
  if (!year) {
    return new Response(JSON.stringify({ error: "Missing year parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { results } = await context.env.DB.prepare(
      "SELECT date, name, is_leave_together FROM holidays WHERE date LIKE ? ORDER BY date ASC, name ASC"
    ).bind(`${year}-%`).all();

    if (!results || results.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=604800, s-maxage=2592000", // Browser: 7 days, Edge: 30 days
          "X-Cache": "MISS"
        }
      });
    }

    // Normalize is_leave_together to boolean format expected by the frontend client
    const mappedResults = results.map(r => ({
      date: r.date,
      name: r.name,
      is_leave_together: r.is_leave_together === 1 || r.is_leave_together === true
    }));

    const response = new Response(JSON.stringify(mappedResults), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=604800, s-maxage=2592000", // Browser: 7 days, Edge: 30 days
        "X-Cache": "MISS"
      }
    });

    // Store in cache asynchronously
    if (cache) {
      try {
        context.waitUntil(cache.put(cacheKey, response.clone()));
      } catch (cachePutError) {
        console.warn("Cache put failed:", cachePutError);
      }
    }

    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
