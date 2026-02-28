import { z } from "zod";

/* Environment Variables */

export const malojaRecentCutoffSecondsSchema = z.coerce
    .number()
    .min(3600)
    .max(2592000);

export const malojaTopPeriodDaysSchema = z.coerce.number().min(1).max(90);

export const malojaTopTracksMinPlayCountSchema = z.coerce.number().min(1);

/* Scrobbles */

const nonEmptyStringArraySchema = z.array(z.string().nonempty()).nonempty();

const malojaScrobbleSchema = z.object({
    time: z.number().gt(0),
    track: z.object({
        artists: nonEmptyStringArraySchema,
        title: z.string().nonempty(),
        album: z.object({
            artists: nonEmptyStringArraySchema,
            albumtitle: z.string().nonempty(),
        }),
        length: z.number().nullable(),
    }),
    duration: z.number().nullable(),
    origin: z.string().nonempty(),
});

export type MalojaScrobble = z.infer<typeof malojaScrobbleSchema>;

export const malojaScrobblesResponseSchema = z.object({
    status: z.literal("ok"),
    list: z.array(malojaScrobbleSchema),
    pagination: z.object({
        page: z.number().gte(0),
        perpage: z.number().gt(0),
        next_page: z.string().nonempty().nullable(),
        prev_page: z.string().nonempty().nullable(),
    }),
});

export type MalojaScrobblesResponse = z.infer<
    typeof malojaScrobblesResponseSchema
>;
