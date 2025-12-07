import { z } from "zod";

/* Authentication */

export const spotifyAccessTokenResponseSchema = z.object({
    access_token: z.string().nonempty(),
});

export type SpotifyAccessTokenResponse = z.infer<
    typeof spotifyAccessTokenResponseSchema
>;

/* Search Tracks */

const spotifySearchTracksItemSchema = z.object({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    popularity: z.number().min(0).max(100),
    type: z.literal("track"),
    is_playable: z.boolean(),
    is_local: z.boolean(),
});

export const spotifySearchTracksResponseSchema = z.object({
    tracks: z.object({
        limit: z.number().gt(0),
        offset: z.number(),
        total: z.number(),
        items: z.array(spotifySearchTracksItemSchema),
    }),
});

export type SpotifySearchTracksItem = z.infer<
    typeof spotifySearchTracksItemSchema
>;
export type SpotifySearchTracksResponse = z.infer<
    typeof spotifySearchTracksResponseSchema
>;

/* Playlist Tracks - Request-Specified Fields */

export const spotifyPlaylistTracksResponseSchema = z.object({
    limit: z.number().nonnegative(),
    total: z.number().nonnegative(),
    offset: z.number().nonnegative(),
    next: z.string().nonempty().nullable(),
    items: z.array(
        z.object({
            track: z.object({
                id: z.string().nonempty(),
                name: z.string().nonempty(),
                artists: z.array(
                    z.object({
                        id: z.string().nonempty(),
                        name: z.string().nonempty(),
                        type: z.literal("artist"),
                    })
                ),
            }),
        })
    ),
});

export type SpotifyPlaylistTracksResponse = z.infer<
    typeof spotifyPlaylistTracksResponseSchema
>;

/* Add Playlist Tracks Response */

export const spotifyAddPlaylistTracksResponseSchema = z.object({
    snapshot_id: z.string().nonempty(),
});
