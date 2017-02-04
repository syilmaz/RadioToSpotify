import {config} from "../env/config";
import {SpotifyAuth, ISpotifyAuthModel} from "../model/spotify_auth";
import {Logger} from "../logger";
import * as moment from "moment";

const SpotifyApi = require('spotify-web-api-node');

const apiInstance = new SpotifyApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret
});

let lastCallDate = null;

export class Api {

    public static instance(callback:Function) {
        SpotifyAuth.findOne({}, (error, model:ISpotifyAuthModel) => {
            if (error) {
                Logger.instance.log('error', 'failed to retrieve auth', error);
                return callback();
            }

            if (!model) {
                Logger.instance.log('error', 'no auth tokens available');
                return callback();
            }

            apiInstance.setAccessToken(model.accessToken);
            apiInstance.setRefreshToken(model.refreshToken);

            if (new Date().getTime() - model.refreshDate.getTime() >= 3600 * 1000) {

                apiInstance.refreshAccessToken()
                    .then((data) => {
                        model.refreshDate = new Date();

                        if (typeof data.body.access_token != 'undefined') {
                            model.accessToken = data.body.access_token;
                        }

                        if (typeof data.body.refresh_token != 'undefined') {
                            model.refreshToken = data.body.refresh_token;
                        }

                        apiInstance.setAccessToken(model.accessToken);
                        apiInstance.setRefreshToken(model.refreshToken);

                        model.save((error) => {
                            if (error) {
                                Logger.instance.log('error', 'failed to save new token', error);
                                return callback();
                            }

                            Logger.instance.debug('Saved access token');
                            callback(apiInstance);
                        });
                    })
                    .catch((error) => {
                        Logger.instance.log('error', 'failed to refresh token', error);
                        return callback();
                    });
            } else {
                Logger.instance.debug('api token is not less than 3600 seconds old, no need to refresh');
                callback(apiInstance);
            }
        });
    }

    public static searchTrack(query:String, callback:Function) {
        this.instance((apiInstance:any) => {
            if (!apiInstance) {
                Logger.instance.error("didn't receive an api client, can't make call to Spotify");
                return callback(new Error('no api client'));
            }

            function doCall() {
                Logger.instance.info('search for tracks with query=' + query);
                apiInstance.searchTracks(query, {'market': 'NL'})
                    .then((data) => {
                        return callback(null, data);
                    })
                    .catch((error) => {
                        Logger.instance.info('error', "failed to do a search", error);
                        return callback(error);
                    });
            }

            if (new Date().getTime() - lastCallDate < 5 * 1000) {
                Logger.instance.info('Delaying API call since the last call is done less than 5 seconds ago');
                setTimeout(doCall, 5 * 1000);
            } else {
                doCall();
            }

            lastCallDate = new Date();
        });
    }

    public static getAudioFeaturesForTracks(trackIds:any[], callback:Function) {
        this.instance((apiInstance:any) => {
            if (!apiInstance) {
                Logger.instance.error("didn't receive an api client, can't make call to Spotify");
                return callback(new Error('no api client'));
            }

            function doCall() {
                Logger.instance.info('analyse track ids=' + trackIds.length);
                apiInstance.getAudioFeaturesForTracks(trackIds)
                    .then((data) => {
                        return callback(null, data);
                    })
                    .catch((error) => {
                        Logger.instance.info('error', "failed to get audio features", error);
                        return callback(error);
                    });
            }

            if (new Date().getTime() - lastCallDate < 5 * 1000) {
                Logger.instance.info('Delaying API call since the last call is done less than 5 seconds ago');
                setTimeout(doCall, 5 * 1000);
            } else {
                doCall();
            }

            lastCallDate = new Date();
        });
    }

    public static getPlaylistTracks(username:String, playlistId:String, options:Object, callback:Function):void {
        this.instance((apiInstance:any) => {
            if (!apiInstance) {
                Logger.instance.error("didn't receive an api client, can't make call to Spotify");
                return callback(new Error('no api client'));
            }

            apiInstance.getPlaylistTracks(username, playlistId, options)
                .then((data) => {
                    return callback(null, data.body);
                })
                .catch((error) => {
                    return callback(error);
                });
        });
    }

    public static addTracksToPlaylist(username:String, playlistId:String, trackUris:any[], callback:Function) {
        this.instance((apiInstance:any) => {
            if (!apiInstance) {
                Logger.instance.error("didn't receive an api client, can't make call to Spotify");
                return callback(new Error('no api client'));
            }

            function doCall() {
                Logger.instance.info('analyse track ids=' + trackUris.length);
                apiInstance.addTracksToPlaylist(username, playlistId, trackUris)
                    .then(() => {
                        return callback();
                    })
                    .catch((error) => {
                        Logger.instance.info('error', "failed to add tracks", error);
                        return callback(error);
                    });
            }

            if (new Date().getTime() - lastCallDate < 5 * 1000) {
                Logger.instance.info('Delaying API call since the last call is done less than 5 seconds ago');
                setTimeout(doCall, 5 * 1000);
            } else {
                doCall();
            }

            lastCallDate = new Date();
        });
    }

}