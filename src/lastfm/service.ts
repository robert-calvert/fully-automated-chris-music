import { URLSearchParams } from "url";
import {
    lastFmRecentCutoffSecondsSchema,
    lastFmRecentTracksResponseSchema,
    lastFmTopTracksMinPlayCountSchema,
    lastFmTopTracksPeriodSchema,
    lastFmTopTracksResponseSchema,
} from "./types";
import { apiGet } from "../util/api";
import { Track } from "../track";
import z from "zod";

const LAST_FM_API_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const LAST_FM_API_MAX_LIMIT = 200;

export async function getLastFmRecentTracks(): Promise<Track[]> {
    const recentCutoffSecondsResult = lastFmRecentCutoffSecondsSchema.safeParse(
        process.env.LASTFM_RECENT_CUTOFF_SECONDS
    );
    if (!recentCutoffSecondsResult.success) {
        throw new Error(
            "Missing or invalid environment variable for Last.fm recent tracks cutoff: " +
                z.prettifyError(recentCutoffSecondsResult.error)
        );
    }

    const requestParams = getBaseRequestParams();
    requestParams.append("method", "user.getRecentTracks");

    const unixNowSeconds = Math.ceil(Date.now() / 1000);
    requestParams.append(
        "from",
        (unixNowSeconds - recentCutoffSecondsResult.data).toString()
    );
    requestParams.append("to", unixNowSeconds.toString());

    const recentTracksResponse = await apiGet(
        LAST_FM_API_BASE_URL + "?" + requestParams.toString(),
        lastFmRecentTracksResponseSchema
    );

    const seenTracks = new Set<string>();
    return recentTracksResponse.recenttracks.track.reduce<Track[]>(
        (acc, track) => {
            const name = track.name;
            const artist = track.artist["#text"];
            const key = name + "::" + artist;

            if (seenTracks.has(key)) {
                return acc;
            }

            seenTracks.add(key);
            acc.push({ name, artist });
            return acc;
        },
        []
    );
}

export async function getLastFmTopTracks(): Promise<Track[]> {
    const periodResult = lastFmTopTracksPeriodSchema.safeParse(
        process.env.LASTFM_TOP_PERIOD
    );
    if (!periodResult.success) {
        throw new Error(
            "Missing or invalid environment variable for Last.fm top tracks period: " +
                z.prettifyError(periodResult.error)
        );
    }

    const minPlayCountResult = lastFmTopTracksMinPlayCountSchema.safeParse(
        process.env.LASTFM_TOP_MIN_PLAY_COUNT
    );
    if (!minPlayCountResult.success) {
        throw new Error(
            "Missing or invalid environment variable for Last.fm top tracks minimum play count: " +
                z.prettifyError(minPlayCountResult.error)
        );
    }

    const requestParams = getBaseRequestParams();
    requestParams.append("method", "user.getTopTracks");
    requestParams.append("period", periodResult.data);

    const topTracksResponse = await apiGet(
        LAST_FM_API_BASE_URL + "?" + requestParams.toString(),
        lastFmTopTracksResponseSchema
    );

    const seenTracks = new Set<string>();
    return topTracksResponse.toptracks.track
        .filter((track) => track.playcount >= minPlayCountResult.data)
        .reduce<Track[]>((acc, track) => {
            const name = track.name;
            const artist = track.artist.name;
            const key = name + "::" + artist;

            if (seenTracks.has(key)) {
                return acc;
            }

            seenTracks.add(key);
            acc.push({ name, artist });
            return acc;
        }, []);
}

function getBaseRequestParams(): URLSearchParams {
    if (!process.env.LASTFM_USERNAME || !process.env.LASTFM_API_KEY) {
        throw new Error(
            "Missing required environment variables for Last.fm API."
        );
    }

    return new URLSearchParams({
        user: process.env.LASTFM_USERNAME,
        api_key: process.env.LASTFM_API_KEY,
        format: "json",
        limit: LAST_FM_API_MAX_LIMIT.toString(),
    });
}
