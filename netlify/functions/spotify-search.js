/* Resolve an event/artist name to a Spotify track + artist using the
   Client Credentials flow (no user login). Keeps the client id/secret
   server-side. Returns ids the page embeds via open.spotify.com/embed.

   Env vars (set in Netlify → Site settings → Environment, or .env for
   `netlify dev`):
     SPOTIFY_CLIENT_ID
     SPOTIFY_CLIENT_SECRET
*/

// Module-scope token cache — reused across warm invocations.
let tokenCache = { token: null, exp: 0 };

async function getToken(id, secret) {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("token_" + r.status);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tokenCache.token;
}

// Event titles are messy ("Live Music at The Grove - Ian Santillano").
// Try the full string first, then the segment after a dash/colon.
function candidates(name) {
  const n = (name || "").trim();
  if (!n) return [];
  const out = [n];
  const parts = n.split(/\s[-–—:|]\s/);
  if (parts.length > 1) {
    const tail = parts[parts.length - 1].trim();
    if (tail.length >= 2 && tail.toLowerCase() !== n.toLowerCase()) out.push(tail);
  }
  return [...new Set(out)];
}

async function searchOne(token, q) {
  const url =
    "https://api.spotify.com/v1/search?type=artist,track&limit=1&market=US&q=" +
    encodeURIComponent(q);
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error("search_" + r.status);
  const j = await r.json();
  const artist = j.artists && j.artists.items && j.artists.items[0];
  const track = j.tracks && j.tracks.items && j.tracks.items[0];
  if (!artist && !track) return null;
  return {
    ok: true,
    query: q,
    artistId: artist ? artist.id : null,
    artistName: artist ? artist.name : null,
    artistImage: artist && artist.images && artist.images[0] ? artist.images[0].url : null,
    trackId: track ? track.id : null,
    trackName: track ? track.name : null,
    previewUrl: track ? track.preview_url : null,
  };
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=86400", // cache resolved lookups for a day
  };
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const q = ((event.queryStringParameters || {}).q || "").trim();

  if (!id || !secret)
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false, error: "not_configured" }) };
  if (!q)
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "missing_q" }) };

  try {
    const token = await getToken(id, secret);
    for (const cand of candidates(q)) {
      const hit = await searchOne(token, cand);
      if (hit) return { statusCode: 200, headers, body: JSON.stringify(hit) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, artistId: null, trackId: null }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};
