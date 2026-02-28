# Fully Automated Chris Music

A simple Node utility to pull top and recent scrobbles (track listens) from either a private Maloja scrobbling server or a public Last.fm profile and add them to your Spotify playlists. I developed this to keep up with a friend's music listening after he moved off Spotify.

## Setup and Deployment

This is intended for use with a single Spotify account and for someone who can run a `node` command with a `cron`-like utility on a defined schedule.

### APIs

If using Maloja, you will need the base URL of the scrobbling server and a username and password for basic authentication.

If using Last.fm, you will need to create a [Last.fm API](https://www.last.fm/api#getting-started) app to get a static API key.

You will also need to create a [Spotify Web API](https://developer.spotify.com/documentation/web-api/tutorials/getting-started) app that you can authorise your Spotify account with, and get a refresh token for that has the `playlist-modify-private playlist-modify-public` scopes.

### Usage

First-time setup:
```
npm install
```
Create a `.env` file as per the example below.

Running the **recent tracks** job, that adds tracks listened to in a set period (e.g. last 24 hours) to the target Spotify playlist:
```
npx tsx src/recent.ts
```

Running the **top tracks** job, that adds the top tracks listened to over a longer period (e.g. last 7 days) over a defined play count to the target Spotify playlist:
```
npx tsx src/top.ts
```

## Environment Variables

```dotenv
# "maloja" or "lastfm"
SCROBBLING_SOURCE=maloja

# Maloja
# The base URL of the Maloja scrobbling server.
MALOJA_BASE_URL=https://maloja.example.com
# The username of your basic auth for Maloja.
MALOJA_AUTH_USERNAME=
# The password of your basic auth for Maloja.
MALOJA_AUTH_PASSWORD=
# The cutoff in seconds for the recent tracks job when pulling from Maloja.
MALOJA_RECENT_CUTOFF_SECONDS=86400
# The number of days in the past to measure listening for the top period.
MALOJA_TOP_PERIOD_DAYS=7
# The minimum play count for a track to be included in a top tracks job run when pulling from Maloja.
MALOJA_TOP_MIN_PLAY_COUNT=4

# Last.fm
# The static API key of your Last.fm app.
LASTFM_API_KEY=
# The username of the Last.fm profile to pull listening data from.
LASTFM_USERNAME=
# The cutoff in seconds for the recent tracks job when pulling from Last.fm.
LASTFM_RECENT_CUTOFF_SECONDS=86400
# The period over which to measure top tracks. Any of: overall | 7day | 1month | 3month | 6month | 12month
LASTFM_TOP_PERIOD=7day
# The minimum play count for a track to be included in a top tracks job run when pulling from Last.fm.
LASTFM_TOP_MIN_PLAY_COUNT=4

# Spotify
# The Client ID of your Spotify API app.
SPOTIFY_CLIENT_ID=
# The Client Secret of your Spotify API app.
SPOTIFY_CLIENT_SECRET=
# A refresh token for your Spotify user with your app with these scopes: playlist-modify-private playlist-modify-public
SPOTIFY_REFRESH_TOKEN=
# The market of your Spotify user to determine track availability.
SPOTIFY_MARKET=NZ
# The ID of the Spotify playlist to add top tracks to.
SPOTIFY_TOP_PLAYLIST_ID=
# The ID of the Spotify playlist to add recent tracks to.
SPOTIFY_RECENT_PLAYLIST_ID=
# An optional maximum age, in days, of a track in the recent playlist before it is deleted on the next run.
SPOTIFY_RECENT_ROLLING_MAX_AGE_DAYS=30
```