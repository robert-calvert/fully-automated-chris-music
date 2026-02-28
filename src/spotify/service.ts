import {
    spotifyAccessTokenResponseSchema,
    spotifyMutatePlaylistTracksResponseSchema,
    SpotifyPlaylistTracksResponse,
    spotifyPlaylistTracksResponseSchema,
    spotifyRecentRollingMaxAgeDaysSchema,
    spotifySearchTracksResponseSchema,
} from "./schemas";
import { apiDelete, apiGet, apiPost } from "../util/api";
import { Track, UpdatePlaylistResult } from "./types";

const API_BASE_URL = "https://api.spotify.com/v1";
const MARKET = process.env.SPOTIFY_MARKET || "NZ";
const MAX_PLAYLIST_ITEMS_LIMIT = 10;
const MAX_PLAYLIST_MUTATIONS_LIMIT = 100;

async function getSpotifyAccessToken(): Promise<string> {
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!(refreshToken && clientId && clientSecret)) {
        throw new Error(
            "Missing or invalid environment variables for Spotify API authentication"
        );
    }

    const accessTokenResponse = await apiPost(
        "https://accounts.spotify.com/api/token",
        {
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        },
        spotifyAccessTokenResponseSchema,
        {
            "Content-Type": "application/x-www-form-urlencoded",
        }
    );
    return accessTokenResponse.access_token;
}

async function getPageOfSpotifyPlaylistItems(
    accessToken: string,
    playlistId: string,
    offset: number
): Promise<SpotifyPlaylistTracksResponse> {
    const requestParams = new URLSearchParams({
        fields: "total,limit,offset,next,items(added_at,item(id,name,artists))",
        market: MARKET,
        limit: MAX_PLAYLIST_ITEMS_LIMIT.toString(),
        offset: offset.toString(),
    });

    return await apiGet(
        API_BASE_URL +
            "/playlists/" +
            playlistId +
            "/items?" +
            requestParams.toString(),
        spotifyPlaylistTracksResponseSchema,
        {
            Authorization: "Bearer " + accessToken,
        }
    );
}

async function getSpotifyPlaylistTracks(
    accessToken: string,
    playlistId: string,
    maxPlaylistSize: number = 500
): Promise<Track[]> {
    let offset = 0;
    let hasNext = true;
    const allTracks: Track[] = [];

    while (hasNext) {
        const pageResponse = await getPageOfSpotifyPlaylistItems(
            accessToken,
            playlistId,
            offset
        );
        for (const item of pageResponse.items) {
            allTracks.push({
                name: item.item.name,
                artist: item.item.artists
                    .map((artist) => artist.name)
                    .join(", "),
                spotifyId: item.item.id,
                spotifyAddedAtUnixSeconds: Math.ceil(
                    new Date(item.added_at).getTime() / 1000
                ),
            });
        }

        if (offset >= maxPlaylistSize) {
            break;
        }

        offset += MAX_PLAYLIST_ITEMS_LIMIT;
        hasNext = pageResponse.next !== null;
    }

    return allTracks;
}

async function applyRollingWindowToSpotifyPlaylist(
    accessToken: string,
    playlistId: string,
    tracks: Track[],
    maxAgeDays: number
): Promise<Track[]> {
    const unixNowSeconds = Math.ceil(Date.now() / 1000);
    const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
    const agedOutTracks = tracks.filter(
        (track) =>
            track.spotifyAddedAtUnixSeconds &&
            unixNowSeconds - track.spotifyAddedAtUnixSeconds > maxAgeSeconds
    );

    if (agedOutTracks.length === 0) {
        return tracks;
    }

    const requests = Math.ceil(
        agedOutTracks.length / MAX_PLAYLIST_MUTATIONS_LIMIT
    );
    for (let i = 0; i < requests; i++) {
        const index = i * MAX_PLAYLIST_MUTATIONS_LIMIT;
        const trackUrisToDelete = agedOutTracks
            .slice(index, index + MAX_PLAYLIST_MUTATIONS_LIMIT)
            .map((track) => {
                return { uri: "spotify:track:" + track.spotifyId };
            });

        await apiDelete(
            API_BASE_URL + "/playlists/" + playlistId + "/items",
            {
                items: trackUrisToDelete,
            },
            spotifyMutatePlaylistTracksResponseSchema,
            {
                Authorization: "Bearer " + accessToken,
            }
        );
    }

    return tracks.filter((track) => !agedOutTracks.includes(track));
}

async function searchForSpotifyTrack(
    accessToken: string,
    name: string,
    artist: string
): Promise<string | null> {
    const requestParams = new URLSearchParams({
        q: "track:" + name.trim() + " artist:" + artist.trim(),
        type: "track",
        market: MARKET,
        limit: "1",
    });

    const searchTrackResponse = await apiGet(
        API_BASE_URL + "/search?" + requestParams.toString(),
        spotifySearchTracksResponseSchema,
        {
            Authorization: "Bearer " + accessToken,
        }
    );

    const track = searchTrackResponse.tracks.items.find(
        (track) => track.is_playable && !track.is_local
    );
    return track?.id ?? null;
}

async function searchForSpotifyTracks(
    accessToken: string,
    tracks: Track[]
): Promise<string[]> {
    const batchSize = 20;
    const ids: string[] = [];

    for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize);

        const results = await Promise.all(
            batch.map((track) =>
                searchForSpotifyTrack(accessToken, track.name, track.artist)
            )
        );

        ids.push(...results.filter((id): id is string => id !== null));
    }

    return ids;
}

async function addTracksToSpotifyPlaylist(
    accessToken: string,
    playlistId: string,
    trackIds: string[]
) {
    const requests = Math.ceil(trackIds.length / MAX_PLAYLIST_MUTATIONS_LIMIT);
    for (let i = 0; i < requests; i++) {
        const index = i * MAX_PLAYLIST_MUTATIONS_LIMIT;
        const trackUrisToAdd = trackIds
            .slice(index, index + MAX_PLAYLIST_MUTATIONS_LIMIT)
            .map((trackId) => "spotify:track:" + trackId);

        await apiPost(
            API_BASE_URL + "/playlists/" + playlistId + "/tracks",
            {
                uris: trackUrisToAdd,
            },
            spotifyMutatePlaylistTracksResponseSchema,
            {
                Authorization: "Bearer " + accessToken,
            }
        );
    }
}

function identifyNewTracks(
    newTracks: Track[],
    existingTracks: Track[]
): Track[] {
    const trackKey = (track: Track) =>
        `${track.name.trim().toLowerCase()}\0${track.artist.trim().toLowerCase()}`;
    const existingSet = new Set(existingTracks.map(trackKey));
    return newTracks.filter((track) => !existingSet.has(trackKey(track)));
}

export async function addUniqueTracksToSpotifyPlaylist(
    playlistId: string,
    tracks: Track[],
    applyRollingWindow: boolean = false
): Promise<UpdatePlaylistResult> {
    const spotifyAccessToken = await getSpotifyAccessToken();
    let existingTracks = await getSpotifyPlaylistTracks(
        spotifyAccessToken,
        playlistId
    );

    // Delete any tracks that were added earlier than the "rolling window" max age,
    // but only if a max age in days has been set as an environment variable.
    const recentRollingMaxAgeDaysResult =
        spotifyRecentRollingMaxAgeDaysSchema.safeParse(
            process.env.SPOTIFY_RECENT_ROLLING_MAX_AGE_DAYS
        );
    const previousTrackCount = existingTracks.length;
    let deletedCount = 0;
    if (applyRollingWindow && recentRollingMaxAgeDaysResult.success) {
        existingTracks = await applyRollingWindowToSpotifyPlaylist(
            spotifyAccessToken,
            playlistId,
            existingTracks,
            recentRollingMaxAgeDaysResult.data
        );
        deletedCount = previousTrackCount - existingTracks.length;
    }

    // Identify new tracks just from the name and artist.
    // This first pass is imperfect but does save a good number of Spotify search API calls.
    const tracksToAdd = identifyNewTracks(tracks, existingTracks);
    if (tracksToAdd.length === 0) {
        return {
            tracksAdded: 0,
            tracksDeleted: deletedCount,
        };
    }

    // Then do a second pass for duplicates on the exact IDs of the track search results.
    const existingTrackIds = existingTracks.map((track) => track.spotifyId);
    const newTrackIds = (
        await searchForSpotifyTracks(spotifyAccessToken, tracksToAdd)
    ).filter(
        (trackId): trackId is string => !existingTrackIds.includes(trackId)
    );
    if (newTrackIds.length === 0) {
        return {
            tracksAdded: 0,
            tracksDeleted: deletedCount,
        };
    }

    await addTracksToSpotifyPlaylist(
        spotifyAccessToken,
        playlistId,
        newTrackIds
    );

    return {
        tracksAdded: newTrackIds.length,
        tracksDeleted: deletedCount,
    };
}
