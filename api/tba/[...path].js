const TBA_BASE_URL = "https://www.thebluealliance.com/api/v3";

function badRequest(res, message) {
  res.statusCode = 400;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}

export default async function handler(req, res) {
  const authKey = process.env.TBA_AUTH_KEY || process.env.TBA_API_KEY;
  if (!authKey) {
    badRequest(res, "Missing TBA_AUTH_KEY or TBA_API_KEY.");
    return;
  }

  // Support both Vercel's catch-all path param and URL path parsing
  let rawPath = Array.isArray(req.query?.path)
    ? req.query.path.join("/")
    : req.query?.path;

  // Fallback: parse from URL if query param is missing
  if (!rawPath) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    rawPath = url.pathname.replace(/^\/api\/tba\/?/, "");
  }

  if (!rawPath || rawPath.includes("..")) {
    badRequest(res, "Invalid TBA path.");
    return;
  }

  const upstream = await fetch(`${TBA_BASE_URL}/${rawPath}`, {
    headers: {
      "X-TBA-Auth-Key": authKey,
      "User-Agent": "9470-scouting/0.1",
    },
  });

  const body = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=1800");
  res.end(body);
}
