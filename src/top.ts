import dotenv from "dotenv";
import { getLastFmTopTracks } from "./lastfm/service";
import { addUniqueTracksToSpotifyPlaylist } from "./spotify/service";
import { getMalojaTopTracks } from "./maloja/service";
import { Track } from "./spotify/types";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: __dirname + "/../.env", quiet: true });

async function runTopTracksJob() {
    const prefix =
        "[Top Tracks] (" + new Date().toLocaleDateString("en-GB") + ")";

    try {
        const playlistId = process.env.SPOTIFY_TOP_PLAYLIST_ID;
        if (!playlistId) {
            throw new Error(
                "Missing or invalid environment variable for top tracks Spotify playlist."
            );
        }

        let newTopTracks: Track[];
        const scrobblingSource =
            process.env.SCROBBLING_SOURCE?.toLowerCase()?.trim() || "maloja";
        if (scrobblingSource === "lastfm") {
            newTopTracks = await getLastFmTopTracks();
        } else {
            newTopTracks = await getMalojaTopTracks();
        }

        if (newTopTracks.length === 0) {
            console.log(prefix, "No new top tracks.");
            return;
        }

        const result = await addUniqueTracksToSpotifyPlaylist(
            playlistId,
            newTopTracks
        );
        console.log(
            prefix,
            "Added " +
                result.tracksAdded +
                " new tracks to the top tracks playlist."
        );
    } catch (error: unknown) {
        console.error(prefix, error);
        process.exitCode = 1;
    }
}

runTopTracksJob();
