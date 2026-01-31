import { z } from "zod";
import { Track } from "../track";
import { apiGet } from "../util/api";
import {
    malojaRecentCutoffSecondsSchema,
    MalojaScrobble,
    malojaScrobblesResponseSchema,
    malojaTopPeriodDaysSchema,
    malojaTopTracksMinPlayCountSchema,
} from "./types";
import { formatDateYYYYMMDD } from "../util/date";

const MALOJA_MAX_PER_PAGE = 2500;
const DAY_IN_SECONDS = 86400;

async function getMalojaScrobbles(fromDate: string): Promise<MalojaScrobble[]> {
    const baseUrl = process.env.MALOJA_BASE_URL;
    if (!baseUrl) {
        throw new Error(
            "Missing or invalid environment variable for the Maloja base URL"
        );
    }

    const authUsername = process.env.MALOJA_AUTH_USERNAME;
    const authPassword = process.env.MALOJA_AUTH_PASSWORD;
    if (!authUsername || !authPassword) {
        throw new Error(
            "Missing or invalid environment variables for Maloja authentication"
        );
    }

    const params = new URLSearchParams({
        perpage: MALOJA_MAX_PER_PAGE.toString(),
        // No support for pagination in this implementation, but with 2500 scrobbles per page this
        // is fine for my use case of daily and weekly runs, and would probably be fine for monthly.
        page: "0",
        from: fromDate,
    });

    const response = await apiGet(
        `${baseUrl}/apis/mlj_1/scrobbles?${params.toString()}`,
        malojaScrobblesResponseSchema,
        {
            Authorization: "Basic " + btoa(authUsername + ":" + authPassword),
        }
    );

    if (response.pagination.next_page !== null) {
        console.log(
            "Reached per-page limit when fetching Maloja scrobbles, so data may be incomplete!"
        );
    }

    return response.list;
}

export async function getMalojaRecentTracks(): Promise<Track[]> {
    const recentCutoffSecondsResult = malojaRecentCutoffSecondsSchema.safeParse(
        process.env.MALOJA_RECENT_CUTOFF_SECONDS
    );
    if (!recentCutoffSecondsResult.success) {
        throw new Error(
            "Missing or invalid environment variable for Maloja recent tracks cutoff: " +
                z.prettifyError(recentCutoffSecondsResult.error)
        );
    }

    const nowUnixSeconds = Math.ceil(Date.now() / 1000);
    const cutoffUnixSeconds = nowUnixSeconds - recentCutoffSecondsResult.data;

    // Account for a timezone mismatch between local time and the Maloja server time by using
    // the day before the cutoff date as the from param, which is date-only and inclusive,
    // then filtering the resulting scrobbles by their Unix timestamp and our cutoff time.
    const dayBeforeCutoff = new Date(
        (cutoffUnixSeconds - DAY_IN_SECONDS) * 1000
    );
    const scrobbles = (
        await getMalojaScrobbles(formatDateYYYYMMDD(dayBeforeCutoff))
    ).filter((scrobble) => scrobble.time >= cutoffUnixSeconds);

    const seenTracks = new Set<string>();
    return scrobbles.reduce<Track[]>((acc, scrobble) => {
        const name = scrobble.track.title;
        const artist = scrobble.track.artists.join(", ");
        const key = name + "::" + artist;

        if (seenTracks.has(key)) {
            return acc;
        }

        seenTracks.add(key);
        acc.push({ name, artist });
        return acc;
    }, []);
}

export async function getMalojaTopTracks(): Promise<Track[]> {
    const topPeriodDaysResult = malojaTopPeriodDaysSchema.safeParse(
        process.env.MALOJA_TOP_PERIOD_DAYS
    );
    if (!topPeriodDaysResult.success) {
        throw new Error(
            "Missing or invalid environment variable for Maloja top tracks period days: " +
                z.prettifyError(topPeriodDaysResult.error)
        );
    }

    const minPlayCountResult = malojaTopTracksMinPlayCountSchema.safeParse(
        process.env.MALOJA_TOP_MIN_PLAY_COUNT
    );
    if (!minPlayCountResult.success) {
        throw new Error(
            "Missing or invalid environment variable for Maloja top tracks minimum play count: " +
                z.prettifyError(minPlayCountResult.error)
        );
    }

    const nowUnixSeconds = Math.ceil(Date.now() / 1000);
    const cutoffUnixSeconds =
        nowUnixSeconds - topPeriodDaysResult.data * DAY_IN_SECONDS;

    // Account for a timezone mismatch between local time and the Maloja server time by using
    // the day before the cutoff date as the from param, which is date-only and inclusive,
    // then filtering the resulting scrobbles by their Unix timestamp and our cutoff time.
    const dayBeforeCutoff = new Date(
        (cutoffUnixSeconds - DAY_IN_SECONDS) * 1000
    );
    const scrobbles = (
        await getMalojaScrobbles(formatDateYYYYMMDD(dayBeforeCutoff))
    ).filter((scrobble) => scrobble.time >= cutoffUnixSeconds);

    // There is a /charts/tracks endpoint available for Maloja, but due to a potential timezone
    // mismatch and the from param being day-only with no support for a specific time, we're
    // aggregating scrobble counts ourselves so we can run this at any time.
    const counts = new Map<
        string,
        { name: string; artist: string; count: number }
    >();
    for (const scrobble of scrobbles) {
        const name = scrobble.track.title;
        const artist = scrobble.track.artists.join(", ");

        const key = name + "::" + artist;
        const existing = counts.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            counts.set(key, { name, artist, count: 1 });
        }
    }

    return Array.from(counts.values())
        .filter((track) => track.count >= minPlayCountResult.data)
        .sort((a, b) => b.count - a.count)
        .map((track) => ({ name: track.name, artist: track.artist }));
}
