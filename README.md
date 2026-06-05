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

- **Turntable** — spins + tonearm drops when something is playing.
- **Pulsing map** (Leaflet + Carto dark tiles) — one animated pin per live show.
- **Drag-and-drop / click** — drag an artist card to the platter, click the card, or
  click a map pin → "Listen on the player".
- **Spotify embed** — loads the artist (or track) preview player.
- **City selector** + **This weekend / This week** toggle.

## Swap in your real API

All mock data lives in the clearly-marked block at the top of the `<script>` in
[index.html](index.html). Replace the `loadShows()` function:

```js
async function loadShows(cityKey) {
  const r = await fetch(`/api/shows?city=${cityKey}`);
  return await r.json();
}
```

Each show needs this shape:

```js
{
  id, artist, genre, venue,
  date,            // ISO datetime
  when,            // 'weekend' | 'week'
  lat, lng,        // map position
  spotifyArtistId, // OR spotifyTrackId for a specific song
  image            // optional avatar URL
}
```

## Ideas to take it further

- **Tidal** — swap the embed URL for Tidal's embed, or add a source toggle.
- **Auto-locate** the user's city via geolocation and default to it.
- **Genre / time filters** on the crate and map.
- **"Queue"** multiple artists and crossfade between samples.
- Real artist **avatars** in the crate (set `image` on each show).
