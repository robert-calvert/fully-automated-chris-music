export type Track = {
    name: string;
    artist: string;
    spotifyId?: string;
    spotifyAddedAtUnixSeconds?: number;
};

export type UpdatePlaylistResult = {
    tracksAdded: number;
    tracksDeleted: number;
};
