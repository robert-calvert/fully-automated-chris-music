import {
    spotifyAccessTokenResponseSchema,
    spotifyAddPlaylistTracksResponseSchema,
    SpotifyPlaylistTracksResponse,
    spotifyPlaylistTracksResponseSchema,
    spotifySearchTracksResponseSchema,
} from "./types";
import { apiGet, apiPost } from "../util/api";
import { Track } from "../track";

const SPOTIFY_API_BASE_URL = "https://api.spotify.com/v1";
const SPOTIFY_MAX_PLAYLIST_ITEMS_LIMIT = 50;
const SPOTIFY_MARKET = process.env.SPOTIFY_MARKET || "NZ";

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
        fields: "total,limit,offset,next,items(track(id,name,artists))",
        market: SPOTIFY_MARKET,
        limit: SPOTIFY_MAX_PLAYLIST_ITEMS_LIMIT.toString(),
        offset: offset.toString(),
    });

    return await apiGet(
        SPOTIFY_API_BASE_URL +
            "/playlists/" +
            playlistId +
            "/tracks?" +
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
                name: item.track.name,
                artist: item.track.artists
                    .map((artist) => artist.name)
                    .join(", "),
                spotifyId: item.track.id,
            });
        }

        if (offset >= maxPlaylistSize) {
            break;
        }

        offset += SPOTIFY_MAX_PLAYLIST_ITEMS_LIMIT;
        hasNext = pageResponse.next !== null;
    }

    return allTracks;
}

async function searchForSpotifyTrack(
    accessToken: string,
    name: string,
    artist: string
): Promise<string | null> {
    const requestParams = new URLSearchParams({
        q: "track:" + name.trim() + " artist:" + artist.trim(),
        type: "track",
        market: SPOTIFY_MARKET,
        limit: "1",
    });

    const searchTrackResponse = await apiGet(
        SPOTIFY_API_BASE_URL + "/search?" + requestParams.toString(),
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
    const maxItemsPerRequest = 100;
    const requests = Math.ceil(trackIds.length / maxItemsPerRequest);
    for (let i = 0; i < requests; i++) {
        const index = i * maxItemsPerRequest;
        const trackUrisToAdd = trackIds
            .slice(index, index + maxItemsPerRequest)
            .map((trackId) => "spotify:track:" + trackId);

        await apiPost(
            SPOTIFY_API_BASE_URL + "/playlists/" + playlistId + "/tracks",
            {
                uris: trackUrisToAdd,
            },
            spotifyAddPlaylistTracksResponseSchema,
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
    const existingSet = new Set(
        existingTracks.map((track) => track.name + "::" + track.artist)
    );
    return newTracks.filter(
        (track) => !existingSet.has(track.name + "::" + track.artist)
    );
}

export async function addUniqueTracksToSpotifyPlaylist(
    playlistId: string,
    tracks: Track[]
): Promise<number> {
    const spotifyAccessToken = await getSpotifyAccessToken();
    const existingTracks = await getSpotifyPlaylistTracks(
        spotifyAccessToken,
        playlistId
    );
    // First, identify new tracks just from the name and artist.
    // This first pass is imperfect but does save a good number of Spotify search API calls.
    const tracksToAdd = identifyNewTracks(tracks, existingTracks);
    if (tracksToAdd.length === 0) {
        return 0;
    }

    // Then do a second pass for duplicates on the exact IDs of the track search results.
    const existingTrackIds = existingTracks.map((track) => track.spotifyId);
    const newTrackIds = (
        await searchForSpotifyTracks(spotifyAccessToken, tracksToAdd)
    ).filter(
        (trackId): trackId is string => !existingTrackIds.includes(trackId)
    );
    if (newTrackIds.length === 0) {
        return 0;
    }

    await addTracksToSpotifyPlaylist(
        spotifyAccessToken,
        playlistId,
        newTrackIds
    );

    return newTrackIds.length;
}
