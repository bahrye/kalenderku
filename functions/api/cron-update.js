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

  // Get GITHUB_PAT from environment secrets
  const githubPat = context.env.GITHUB_PAT;
  if (!githubPat) {
    return new Response(JSON.stringify({ error: "Configuration Error: GITHUB_PAT secret is missing in Cloudflare Pages Dashboard" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Trigger GitHub Actions Repository Dispatch to run the sync workflow
  try {
    const response = await fetch(
      "https://api.github.com/repos/bahrye/kalenderku/dispatches",
      {
        method: "POST",
        headers: {
          "User-Agent": "Cloudflare-Pages-Worker",
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${githubPat}`,
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          event_type: "sync_holidays"
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API returned status ${response.status}: ${errorText}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "GitHub Actions sync workflow triggered successfully by cron-job.org" 
      }), 
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json" 
        }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
