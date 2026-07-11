export async function onRequest(context) {
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT key, value FROM metadata"
    ).all();

    const data = {};
    if (results) {
      for (const row of results) {
        data[row.key] = row.value;
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
