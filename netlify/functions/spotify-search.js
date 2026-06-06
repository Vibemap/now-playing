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

// Event titles are messy: "By Storm (FKA Injury Reserve) — My Ghost Go Ghost Tour",
// "Live Music at The Grove - Ian Santillano", "San Francisco Opera - The Barber…".
// Derive an ORDERED list of likely performer names (best guess first).
const SEPARATOR = /\s*[—–]\s*|\s+-\s+|\s*[:|•·\/]\s+|\s+(?:presents?|feat\.?|ft\.?|featuring|with|w\/|x)\s+/i;
const VENUE_PREFIX = /^(live music|live|music|an evening|a night|tonight|presented|presents|dj set|brunch|happy hour|open mic|karaoke|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const TOUR_SUFFIX = /\b(tour|live|concert|in concert|residency|world tour|album release|release party|experience|presents)\b.*$/i;
const VENUE_WORDS = /\b(hall|theat(?:er|re)|club|society|arts|cent(?:er|re)|lounge|room|bar|stage|saloon|venue|auditorium|house|park|cafe|chapel|church|gallery|garden|winery|street|ave|avenue|sf)\b/i;

function candidates(rawName) {
  const n0 = (rawName || "").trim();
  if (!n0) return [];
  const out = [];
  const add = (s) => {
    s = (s || "").replace(TOUR_SUFFIX, "").replace(/[,–—\-:|•·]+$/, "").replace(/\s{2,}/g, " ").trim();
    if (s.length >= 2 && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  };

  // capture a "FKA / aka / formerly" alias before stripping parentheticals
  const alias = n0.match(/\b(?:fka|aka|formerly|f\.k\.a\.?)\s+([^)\]]+)/i);

  // drop parentheticals/brackets (tour years, "(Live)", "(FKA …)")
  const n = n0.replace(/[\(\[][^\)\]]*[\)\]]/g, " ").replace(/\s{2,}/g, " ").trim();

  const segs = n.split(SEPARATOR).map((s) => s.trim()).filter(Boolean);

  // "<artist> at <venue>" — split only when the right side looks like a venue
  const atV = n.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atV && VENUE_WORDS.test(atV[2])) add(atV[1].split(SEPARATOR)[0].trim());

  if (segs.length) {
    if (VENUE_PREFIX.test(segs[0]) && segs[1]) add(segs[1]); // "Live Music at … - <artist>"
    else add(segs[0]);                                       // artist is usually the first chunk
  }
  if (alias && alias[1]) add(alias[1]);                      // former (often better-known) name
  if (segs[1]) add(segs[1]);                                 // other side of the separator
  add(n);                                                    // whole cleaned title, last resort
  return out.slice(0, 4);
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

/* An artist's top tracks (public catalog) — used to randomize / flip songs. */
async function getTopTracks(token, artistId) {
  try {
    const r = await fetch(
      "https://api.spotify.com/v1/artists/" + artistId + "/top-tracks?market=US",
      { headers: { Authorization: "Bearer " + token } }
    );
    if (!r.ok) return [];
    const j = await r.json();
    return (j.tracks || []).slice(0, 10).map((t) => ({ id: t.id, name: t.name }));
  } catch (e) {
    return [];
  }
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
      if (hit) {
        if (hit.artistId) hit.topTracks = await getTopTracks(token, hit.artistId);
        return { statusCode: 200, headers, body: JSON.stringify(hit) };
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, artistId: null, trackId: null }) };
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};
