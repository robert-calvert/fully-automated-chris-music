import { z } from "zod";

/* Recent Tracks */

export const lastFmRecentCutoffSecondsSchema = z.coerce.number().min(3600);

const lastFmRecentTrackSchema = z.object({
    name: z.string().nonempty(),
    artist: z.object({
        "#text": z.string().nonempty(),
    }),
    date: z
        .object({
            uts: z.coerce.number().gt(0),
        })
        .optional(),
});

export const lastFmRecentTracksResponseSchema = z.object({
    recenttracks: z.object({
        track: z.array(lastFmRecentTrackSchema),
    }),
});

export type LastFmRecentTrack = z.infer<typeof lastFmRecentTrackSchema>;
export type LastFmRecentTracksResponse = z.infer<
    typeof lastFmRecentTracksResponseSchema
>;

/* Top Tracks */

export const lastFmTopTracksPeriodSchema = z.enum([
    "7day",
    "1month",
    "3month",
    "6month",
    "12month",
    "overall",
]);
export const lastFmTopTracksMinPlayCountSchema = z.coerce.number().min(1);

const lastFmTopTrackSchema = z.object({
    name: z.string().nonempty(),
    artist: z.object({
        name: z.string().nonempty(),
    }),
    playcount: z.coerce.number().gt(0),
});

export const lastFmTopTracksResponseSchema = z.object({
    toptracks: z.object({
        track: z.array(lastFmTopTrackSchema),
    }),
});

export type LastFmTopTrack = z.infer<typeof lastFmTopTrackSchema>;
export type LastFmTopTracksResponse = z.infer<
    typeof lastFmTopTracksResponseSchema
>;
