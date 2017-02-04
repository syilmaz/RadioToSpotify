import { Scheduler } from "../scheduler";
import { Logger } from "./../logger";
import { SpotifyTrack, ISpotifyTrackModel } from "../model/spotify_track";
import { Station, IStationModel } from "../model/station";

import {Api} from "./api";
import * as _ from "lodash";
import * as moment from "moment-timezone";

import {ObjectID} from "mongodb";
import {PlayedTrack, IPlayedTrackModel} from "../model/played_track";

const SCHEDULE_TIME = 10 * 60 * 1000;
const MAX_DATE_IN_PAST = moment().subtract(4, 'days');
const MAX_ITEMS_TO_ADD = 80;

let playlists = {};

export class SpotifyPlaylist {
    private scheduler: Scheduler;

    constructor() {
        this.scheduler = new Scheduler(SCHEDULE_TIME);
        this.scheduler.on("timer", this.updatePlaylists.bind(this));
    }

    public start():void {
        // load the playlist from spotify first
        this.loadSpotifyList((error) => {
            if (error) {
                Logger.instance.log('error', 'failed to retrieve playlist', error);
                process.exit(1);
                return;
            }

            Logger.instance.info('Loaded all playlists, starting scheduler');
            this.scheduler.start();
        });
    }

    public updatePlaylists(callback:Function):void {
        let stationIds = Object.keys(playlists);
        let index = 0;

        const updatePlaylistForStations = (innerCallback:Function) => {
            let stationId = stationIds.shift();
            Logger.instance.info(`updating playlist for stationId: ${stationId}`);

            Station.findOne({_id: new ObjectID(stationId)}, (error, station:IStationModel) => {

                if (error) {
                    Logger.instance.log('error', 'error', error);
                    return innerCallback(error);
                }

                Logger.instance.info(`updating playlist for station: ${station.name}`);

                PlayedTrack.aggregate([
                    {
                        $match: {
                            stationId: station._id,
                            playedAt: {
                                $gte: MAX_DATE_IN_PAST.toDate()
                            },
                            spotifyTrackUri: {$exists: true}
                        }
                    },
                    {
                        $project: {
                            hour: { $hour: "$playedAt" },
                            spotifyTrackId: 1,
                            spotifyTrackUri: 1
                        }
                    },
                    {
                        $match: {
                            hour: { $gte: 6, $lte: 19 }
                        }
                    },
                    {
                        $group: {
                            _id: '$spotifyTrackId',
                            spotifyTrackId: { $first: '$spotifyTrackId' },
                            spotifyTrackUri: { $first: '$spotifyTrackUri' }
                        }
                    }
                ]).exec((error, results) => {
                    if (error) {
                        Logger.instance.log('error', 'error', error);
                        return innerCallback(error);
                    }

                    if (results.length == 0) {
                        Logger.instance.info('Nothing to add to playlist');
                        return innerCallback();
                    }

                    // Check the playlist whether the track is already added
                    let tracksAdded = playlists[stationId];
                    let shouldAddTracks = [];

                    for (let i = 0; i < results.length; i++) {
                        let result:IPlayedTrackModel = <IPlayedTrackModel> results[i];

                        if (!tracksAdded[result.spotifyTrackUri]) {
                            shouldAddTracks.push(result.spotifyTrackUri);
                        }
                    }

                    if (shouldAddTracks.length === 0) {
                        Logger.instance.info('Nothing to add to playlist (shouldAddTracks is empty)');

                        if (stationIds.length > 0) {
                            Logger.instance.info('More station ids, need to add more tracks');
                            updatePlaylistForStations(innerCallback);
                        } else {
                            Logger.instance.info('Done updating all stations');
                            innerCallback();
                        }
                        
                        return;
                    }

                    Logger.instance.info(`found ${shouldAddTracks.length} tracks to add`);

                    this.addTracksToPlaylist(station, shouldAddTracks, (error) => {
                        if (error) {
                            Logger.instance.log('error', 'error', error);
                            return innerCallback(error);
                        }

                        if (stationIds.length > 0) {
                            Logger.instance.info('More station ids, need to add more tracks');
                            updatePlaylistForStations(innerCallback);
                        } else {
                            Logger.instance.info('Done updating all stations');
                            innerCallback();
                        }
                    });
                });
            });
        };


        updatePlaylistForStations((error) => {
            if (error) {
                Logger.instance.log('error', 'failed to update station', error);
                return callback();
            }

            Logger.instance.info('done updating playlists');
            callback();
        });
    }

    private addTracksToPlaylist(station:IStationModel, tracksToAdd:any[], callback:Function) {

        let parts = station.spotifyPlaylistId.match(/spotify:user:([^:]+):playlist:(.*)/);
        let username = parts[1];
        let playlistId = parts[2];

        if (tracksToAdd.length > MAX_ITEMS_TO_ADD) {
            Logger.instance.info(`More than ${MAX_ITEMS_TO_ADD} added, slicing`);
            tracksToAdd = tracksToAdd.slice(0, MAX_ITEMS_TO_ADD);
        }

        // Only add max 50 at a time
        Api.addTracksToPlaylist(username, playlistId, tracksToAdd, (error) => {
            if (error) {
                Logger.instance.log('error', 'error', error);
                return callback(error);
            }

            for (let i = 0; i < tracksToAdd.length; i++) {
                playlists[station._id.toString()][tracksToAdd[i]] = tracksToAdd[i];
            }

            callback();
        });
    }

    private loadSpotifyList(callback:Function):void {

        // Get stations
        Station.find({
            enabled: true
        }, (error, stations:IStationModel[]) => {

            if (error) {
                Logger.instance.log('error', 'failed to get stations', error);
                return;
            }

            if (stations.length == 0) {
                Logger.instance.info("No active stations");
                return;
            }

            let index = 0;

            const loadStationPlaylist = (station:IStationModel, innerCallback:Function) => {
                if (!station) {
                    return innerCallback();
                }

                this.loadPlaylist(station, (error) => {
                    if (error) {
                        return innerCallback(error);
                    }

                    if (index++ < stations.length) {
                        loadStationPlaylist(stations[index], innerCallback);
                    } else {
                        innerCallback();
                    }
                });
            };


            loadStationPlaylist(stations[index], (error) => {
                if (error) {
                    Logger.instance.log('error', 'failed to retrieve playlist', error);
                    process.exit(1);
                    return;
                }

                callback();
            });
        });
    }


    private loadPlaylist(station:IStationModel, callback:Function) {
        let parts = station.spotifyPlaylistId.match(/spotify:user:([^:]+):playlist:(.*)/);
        let username = parts[1];
        let playlistId = parts[2];

        let tracks = [];
        let limit = 100;
        let offset = 0;

        function getAllTracksFromPlaylist(username, playlistId, innerCallback:Function) {
            Api.getPlaylistTracks(username, playlistId, {limit: limit, offset: offset}, (error, response) => {
                if (error) {
                    return innerCallback(error);
                }


                for (let i = 0; i < response.items.length; i++) {
                    tracks[response.items[i].track.uri] = response.items[i].track.id;
                }

                if (response.next) {
                    Logger.instance.info(`Playlist ${playlistId} contains more tracks. Retrieving next batch`);
                    offset += limit;

                    if (offset > 200) {
                        process.exit(1);
                    }

                    getAllTracksFromPlaylist(username, playlistId, innerCallback);
                } else {
                    Logger.instance.info(`Playlist ${playlistId}: retrieved all tracks. Returning`);
                    innerCallback()
                }
            });
        }

        Logger.instance.info('Retrieving all tracks from playlist');
        getAllTracksFromPlaylist(username, playlistId, (error) => {
            if (error) {
                Logger.instance.log('error', 'failed to get playlist for playlistId:' + playlistId, error);
                return callback();
            }

            Logger.instance.info('Finished retrieving all tracks from playlist');
            playlists[station._id.toString()] = tracks;
            callback();
        });
    }
}