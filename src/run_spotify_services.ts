import { SpotifySearch } from "./spotify/search";
import * as mongoose from "mongoose";
import { Logger } from "./logger";
import {SpotifyPlaylist} from "./spotify/playlist";
import {SpotifyAnalyse} from "./spotify/analyse";

mongoose.connect("mongodb://localhost/radio", (error) => {
    if (error) {
        Logger.instance.error(error.toString());
        process.exit(1);
        return;
    }

    Logger.instance.info("Started mongo connection");

    new SpotifySearch()
        .start();

    new SpotifyPlaylist()
        .start();

    new SpotifyAnalyse()
        .start();
});