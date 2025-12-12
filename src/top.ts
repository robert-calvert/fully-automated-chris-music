import dotenv from "dotenv";
import { getLastFmTopTracks } from "./lastfm/service";
import { addUniqueTracksToSpotifyPlaylist } from "./spotify/service";

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function runTopTracksJob() {
    const prefix = "[Top Tracks]";

    try {
        const playlistId = process.env.SPOTIFY_TOP_PLAYLIST_ID;
        if (!playlistId) {
            throw new Error(
                "Missing or invalid environment variable for top tracks Spotify playlist."
            );
        }

        const newTopTracks = await getLastFmTopTracks();
        if (newTopTracks.length === 0) {
            console.log(prefix, "No new top tracks, stopping.");
            return;
        }

        const addedCount = await addUniqueTracksToSpotifyPlaylist(
            playlistId,
            newTopTracks
        );
        console.log(
            prefix,
            "Added " + addedCount + " new tracks to the top tracks playlist."
        );
    } catch (error: unknown) {
        console.error(prefix, error);
        process.exitCode = 1;
    }
}

runTopTracksJob();
