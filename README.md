# Now Playing 🎧

A prototype web app for discovering artists playing live in your city this week/weekend.
A spinning turntable on the left, a pulsing live-shows map on the right. Drag an artist
onto the platter (or click them, or click a map pin) to hear a Spotify sample.

## Run it

It's a single self-contained `index.html` — no build step.

```bash
# any static server works, e.g.
npx serve .
# then open http://localhost:3000
```

(Spotify embeds need to load over http/https, not `file://`.)

## What's wired up

- **Live SF data** — San Francisco pulls real music shows from the Vibemap API
  (`api.vibemap.com/v0.3/search/events`, filtered to `tags=Music` in San Francisco).
  Los Angeles is mock demo data.
- **Turntable** — spins + tonearm drops when something is playing.
- **Pulsing map** (Leaflet + Carto tiles, light/dark) — one animated pin per live show.
- **Drag-and-drop / click** — drag a card to the platter, click the card, or click a
  map pin → "Listen on the player".
- **Jump off to SF LIVE** — every show links out to its `sflive.art` event page (the
  "View on SF LIVE ↗" link in the player and "Details on SF LIVE ↗" in map popups).
- **Spotify** — embeds a preview when a show has a linked Spotify id; otherwise offers a
  "search on Spotify" link (the feed has no music ids yet — see below).
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

The query is already scoped to SF + `tags=Music`, so the crate is all music acts. The
toggle filters by date window relative to today (weekend = Fri–Sun; week = next 7 days),
and recurring occurrences are collapsed to the soonest show per title. To change the city
or filters, edit the `VIBEMAP_API` query string.

### Adding music samples

The feed has no Spotify/Tidal ids today. When that data exists, set `spotifyArtistId`
(or `spotifyTrackId`) inside `normalizeEvent()` and the player will embed the preview
automatically instead of linking out to a Spotify search.

## Ideas to take it further

- **Tidal** — swap the embed for Tidal's, or add a source toggle.
- **Auto-locate** the user's city via geolocation.
- **Genre filter** — the feed already carries categories/tags (music, dance, theater…).
- **More cities** — point another `live` city at its own Vibemap feed.
- **"Queue"** multiple artists and crossfade between samples.
