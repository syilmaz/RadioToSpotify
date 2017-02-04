import { SpotifyPlaylist } from "./spotify/playlist";
import * as mongoose from "mongoose";
import { Logger } from "./logger";

mongoose.connect("mongodb://localhost/radio", (error) => {
    if (error) {
        Logger.instance.error(error.toString());
        process.exit(1);
        return;
    }

    Logger.instance.info("Started mongo connection");

    new SpotifyPlaylist()
        .start();
});