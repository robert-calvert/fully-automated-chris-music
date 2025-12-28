import dotenv from "dotenv";
import { getLastFmRecentTracks } from "./lastfm/service";
import { addUniqueTracksToSpotifyPlaylist } from "./spotify/service";

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function runRecentTracksJob() {
    const prefix = "[Recent Tracks]";

    try {
        const playlistId = process.env.SPOTIFY_RECENT_PLAYLIST_ID;
        if (!playlistId) {
            throw new Error(
                "Missing or invalid environment variable for recent tracks Spotify playlist."
            );
        }

        const newRecentTracks = await getLastFmRecentTracks();
        if (newRecentTracks.length === 0) {
            console.log(prefix, "No new recent tracks in Last.fm.");
            return;
        }

        const addedCount = await addUniqueTracksToSpotifyPlaylist(
            playlistId,
            newRecentTracks,
            true
        );
        console.log(
            prefix,
            "Added " + addedCount + " new tracks to the recent tracks playlist."
        );
    } catch (error: unknown) {
        console.error(prefix, error);
        process.exitCode = 1;
    }
}

runRecentTracksJob();
