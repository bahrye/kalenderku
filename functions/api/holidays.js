export async function onRequest(context) {
  let cache;
  try {
    cache = caches.default;
  } catch (e) {
    console.warn("Cache API not available:", e);
  }

  const cacheUrl = new URL(context.request.url);
  cacheUrl.searchParams.set("v", "v2"); // Cache busting to force Cloudflare Edge to pull the updated response format
  const cacheKey = new Request(cacheUrl.toString(), context.request);

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
  
  // Validate that the year is present and is a 4-digit number
  const yearPattern = /^\d{4}$/;
  if (!year || !yearPattern.test(year)) {
    return new Response(JSON.stringify({ 
      error: "Format link salah atau parameter tidak valid! Gunakan format '?year=2021' untuk mengakses data tahun 2021 secara spesifik." 
    }), {
      status: 400,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }

  try {
    const { results } = await context.env.DB.prepare(
      "SELECT date, name, is_leave_together FROM holidays WHERE date LIKE ? ORDER BY date ASC, name ASC"
    ).bind(`${year}-%`).all();

    if (!results || results.length === 0) {
      // Fetch available year range (Min Year and Max Year) from database
      const rangeResult = await context.env.DB.prepare(
        "SELECT SUBSTR(MIN(date), 1, 4) as minYear, SUBSTR(MAX(date), 1, 4) as maxYear FROM holidays"
      ).first();

      const minYear = rangeResult?.minYear;
      const maxYear = rangeResult?.maxYear;

      let errorMessage = `Tahun ${year} tidak ditemukan di database.`;
      if (minYear && maxYear) {
        errorMessage = `Tahun ${year} tidak ditemukan di database. Data yang tersedia saat ini hanya dari tahun ${minYear} hingga ${maxYear}.`;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 404,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    // Normalize is_leave_together to boolean and count holiday/leave types
    let jumlahHariLibur = 0;
    let jumlahCuti = 0;

    const mappedResults = results.map(r => {
      const isLeave = r.is_leave_together === 1 || r.is_leave_together === true || r.name.toLowerCase().includes("cuti bersama");
      if (isLeave) {
        jumlahCuti++;
      } else {
        jumlahHariLibur++;
      }
      return {
        date: r.date,
        name: r.name,
        is_leave_together: isLeave
      };
    });

    const payload = {
      nama_pemilik: "Syamsul Bahri",
      jumlah_hari_libur: jumlahHariLibur,
      jumlah_cuti: jumlahCuti,
      data: mappedResults
    };

    const response = new Response(JSON.stringify(payload), {
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
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
