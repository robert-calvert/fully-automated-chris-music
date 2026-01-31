import dotenv from "dotenv";
import { getLastFmRecentTracks } from "./lastfm/service";
import { addUniqueTracksToSpotifyPlaylist } from "./spotify/service";
import { getMalojaRecentTracks } from "./maloja/service";

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function runRecentTracksJob() {
    const prefix =
        "[Recent Tracks] (" + new Date().toLocaleDateString("en-GB") + ")";

    try {
        const playlistId = process.env.SPOTIFY_RECENT_PLAYLIST_ID;
        if (!playlistId) {
            throw new Error(
                "Missing or invalid environment variable for recent tracks Spotify playlist."
            );
        }

        let newRecentTracks;
        const scrobblingSource =
            process.env.SCROBBLING_SOURCE?.toLowerCase()?.trim() || "maloja";
        if (scrobblingSource === "lastfm") {
            newRecentTracks = await getLastFmRecentTracks();
        } else {
            newRecentTracks = await getMalojaRecentTracks();
        }

        if (newRecentTracks.length === 0) {
            console.log(prefix, "No new recent tracks.");
            return;
        }

        const counts = await addUniqueTracksToSpotifyPlaylist(
            playlistId,
            newRecentTracks,
            true
        );
        console.log(
            prefix,
            "Added " +
                counts[0] +
                " new tracks to the recent tracks playlist, deleted " +
                counts[1] +
                "."
        );
    } catch (error: unknown) {
        console.error(prefix, error);
        process.exitCode = 1;
    }
}

runRecentTracksJob();
