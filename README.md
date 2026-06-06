# Now Playing 🎧

A prototype web app for discovering artists playing live in your city this week/weekend.
A spinning turntable on the left, a pulsing live-shows map on the right. Drag an artist
onto the platter (or click them, or click a map pin) to hear a Spotify sample.

## Run it

The UI is a single `index.html`, but audio resolution uses a Netlify function, so run it
with the Netlify CLI to get the function locally:

```bash
npx netlify dev      # serves index.html + functions on http://localhost:5599
```

Without Spotify credentials the player still works — it just shows a "search on Spotify"
link instead of an embedded track. For UI-only work, any static server is fine
(`npx serve .`), but the `/.netlify/functions/*` calls will 404 and fall back.

## Connect Spotify (for real audio)

The Vibemap feed has no Spotify ids, so a small Netlify function
([netlify/functions/spotify-search.js](netlify/functions/spotify-search.js)) matches each
artist/event name to a Spotify track via the **Client Credentials** flow and returns the id;
the player then embeds it. The client secret stays server-side.

1. Create an app at <https://developer.spotify.com/dashboard> → copy the **Client ID** and
   **Client Secret**. (No redirect URI needed — Client Credentials doesn't use one.)
2. Provide the credentials:
   - **Local:** `cp .env.example .env` and fill in the two values (`netlify dev` loads `.env`).
   - **Production:** Netlify → Site settings → Environment variables, or
     `netlify env:set SPOTIFY_CLIENT_ID …` / `SPOTIFY_CLIENT_SECRET …`.
3. `npx netlify dev` and drop an artist on the platter — it resolves and plays.

Resolved lookups are cached (per name in the browser, and a day at the CDN). Many tracks
play a 30s preview; full playback happens for listeners already signed into Spotify.

> Heads up: event titles are messy (e.g. "Live Music at The Grove - Ian Santillano"), so the
> function tries the full name then the part after a dash. Matching won't be perfect; when it
> can't find a confident match it falls back to a Spotify search link.

## What's wired up

- **Live SF data** — San Francisco pulls real music shows from the Vibemap API
  (`api.vibemap.com/v0.3/search/events`, filtered to `tags=Music` in San Francisco).
  Los Angeles is mock demo data.
- **Player style** — a Vinyl / Cassette toggle above the player; cassette reels spin while
  playing. Defaults to Vinyl; choice persists (`np-player`). (Could later default per city.)
- **Turntable** — spins + tonearm drops when something is playing.
- **Pulsing map** (Leaflet + Carto tiles, light/dark) — one animated pin per live show.
- **Drag-and-drop / click** — drag a card to the platter, click the card, or click a
  map pin → "Listen on the player".
- **Jump off to SF LIVE** — every show links out to its `sflive.art` event page (the
  "View on SF LIVE ↗" link in the player and "Details on SF LIVE ↗" in map popups).
- **Spotify** — a Netlify function matches each artist/event name to a Spotify track and the
  player embeds it (see "Connect Spotify" above). Falls back to a search link when there's no
  confident match or no credentials.
- **Genre filter** — chips (Music · Comedy · Dance · Theater · Nightlife) re-query the
  Vibemap API per genre; defaults to Music. Hidden for non-live (mock) cities.
- **Light / dark toggle** + **This weekend / This week** date filter.

## Data source (Vibemap)

SF data is fetched and normalized in [index.html](index.html) — see `VIBEMAP_API`,
`loadShows()`, and `normalizeEvent()`. The endpoint returns a **GeoJSON FeatureCollection**
(`results.features`); each feature is mapped to this shape:

```js
{
  id, artist, genre, venue,
  date,            // ISO datetime (from properties.start_date)
  lat, lng,        // from geometry.coordinates [lng, lat]
  image,           // ImageKit thumbnail (properties.vibemap_images[].thumbnail_url)
  url,             // sflive.art/event/{slug}/ — the "jump off" target
  spotifyArtistId, // OPTIONAL — not in the feed yet
}
```

The genre chips set the `tags=<genre>` value (see `sfApiUrl()` and `GENRES`), so each genre
is its own SF-scoped query. The date toggle then filters by window relative to today
(weekend = Fri–Sun; week = next 7 days), and recurring occurrences are collapsed to the
soonest show per title. To add a genre, append to `GENRES`; to change the city/boundary,
edit `sfApiUrl()`.

> Note: the genre query intentionally omits the `sf-live` curation tag. With `sf-live`
> unioned in, every genre returned the same curated set; plain `tags=<genre>` actually
> filters (e.g. Comedy → stand-up/improv shows).

### Audio resolution path

When a show is played, `play()` checks for a pre-set `spotifyTrackId`/`spotifyArtistId`
first; otherwise it calls `resolveSpotify(name)` → the Netlify function → embed. If Vibemap
ever adds Spotify ids directly to events, set them in `normalizeEvent()` and the function
call is skipped entirely.

## Ideas to take it further

- **Full playback** — swap the embed for the Spotify Web Playback SDK (Premium, requires user
  login via PKCE) for in-page full tracks instead of 30s previews.
- **Better matching** — store the resolved Spotify id back on the event, or have the function
  use venue/date hints to disambiguate.
- **Tidal** — add a source toggle alongside Spotify.
- **Auto-locate** the user's city via geolocation.
- **More cities** — point another `live` city at its own Vibemap boundary.
