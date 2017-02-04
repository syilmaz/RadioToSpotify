import { Scheduler } from "../scheduler";
import { Logger } from "./../logger";
import { SpotifyTrack, ISpotifyTrackModel } from "../model/spotify_track";
import {IPlayedTrackModel, PlayedTrack} from "../model/played_track";

import * as _ from "lodash";
import {Api} from "./api";

const SCHEDULE_TIME = 10 * 60 * 1000;
const MAX_SEARCH_ATTEMPTS = 1;

/** The similarity between the searched track and the query should be equal to or above this value */
const SIMILARITY_THRESHOLD = 0.8;

const escapeStringRegexp = require('escape-string-regexp');
const stringSimilarity = require('string-similarity');

export class SpotifySearch {

    private scheduler: Scheduler;

    constructor() {
        this.scheduler = new Scheduler(SCHEDULE_TIME);
        this.scheduler.on("timer", this.searchSpotifyTracks.bind(this));
    }

    public start():void {
        Logger.instance.info(`Starting schedules with a delay of ${SCHEDULE_TIME}ms`);
        this.scheduler.start();
    }

    private searchSpotifyTracks(doneCallback:Function):void {

        Logger.instance.info("Retrieving tracks for which we need a Spotify Track ID");

        PlayedTrack.find(
            {
                spotifyTrackId: { $exists: false },
                process: { $in: [ false, null ] },
                $or: [{attempts: {$lte: MAX_SEARCH_ATTEMPTS}}, {attempts: {$exists: false}}]
            },
            null,
            { playedAt: -1, attempts: 1 },
            (error, results: IPlayedTrackModel[]) => {

                if (error) {
                    Logger.instance.log("error", "Failed to retrieve spotify tracks", error);
                    return;
                }

                if (results.length === 0) {
                    Logger.instance.info("Nothing to search for");
                    return doneCallback();
                }

                Logger.instance.info(`Found ${results.length} num tracks to search for`);

                // Only first one
                this.searchForTracks(results, () => {
                    doneCallback();
                });


            });
    }

    private searchForTracks(results:IPlayedTrackModel[], callback:Function):void {
        let result:IPlayedTrackModel = results.shift();

        this.searchForTrack(result, () => {
            if (results.length === 0) {
                callback();
                return;
            }
            this.searchForTracks(results, callback);
        });
    }

    private searchForTrack(playedTrack:IPlayedTrackModel, callback:Function):void {
        Logger.instance.info(`Retrieving Spotify details for track '${playedTrack.track}' by ${playedTrack.artist}`);
        Logger.instance.info('checking database first');

        let searchArtist = escapeStringRegexp(_.trim(playedTrack.artist));
        let searchTrack = escapeStringRegexp(_.trim(playedTrack.track));

        SpotifyTrack.findOne({
            artist: {$regex: new RegExp('^' + searchArtist + '$', 'i')},
            track: {$regex: new RegExp('^' + searchTrack + '$', 'i')}
        }, (error, spotifyTrack: ISpotifyTrackModel) => {
            if (error) {
                Logger.instance.log('error', `failed to find track '${playedTrack.track}' by ${playedTrack.artist} in db`, error);
                return callback();
            }

            if (!spotifyTrack) {
                Logger.instance.info(`track '${playedTrack.track}' by '${playedTrack.artist}' not found in the database. Doing a search.`);

                Api.searchTrack(`track:'${playedTrack.track}' artist:'${playedTrack.artist}'`, (error, response) => {

                    if (error && error.statusCode == 401) {
                        Logger.instance.error('Could not authorize with spotify! Something wrong???');
                        return callback();
                    }

                    if (error || !response || !response.body || response.body.tracks.total === 0) {
                        Logger.instance.error('failed to do search or no results');

                        playedTrack.attempts = (playedTrack.attempts ? playedTrack.attempts : 0) + 1;
                        return playedTrack.save(() => {
                            callback();
                        });
                    }

                    // Find the best match
                    let bestMatch = null;
                    let bestMatchScore = 0;

                    let tracks = response.body.tracks.items;
                    for (let i = 0; i < tracks.length; i++) {
                        let track = tracks[i];
                        let localMatchScore = stringSimilarity.compareTwoStrings(searchTrack, track.name);
                        Logger.instance.debug(`Spotify returned track with name=${track.name}; the similarity score is ${localMatchScore}`);

                        if (localMatchScore > bestMatchScore) {
                            Logger.instance.debug(`The similarity score (${localMatchScore}) is higher than the previous (${bestMatchScore}). Preference is updated`);
                            bestMatch = track;
                            bestMatchScore = localMatchScore;
                        }
                    }

                    if (bestMatchScore < SIMILARITY_THRESHOLD) {
                        Logger.instance.debug(`Highest score found was ${bestMatchScore} with track name ${bestMatch.name}. This is lower than threshold ${SIMILARITY_THRESHOLD}`);
                        playedTrack.attempts = (playedTrack.attempts ? playedTrack.attempts : 0) + 1;
                        return playedTrack.save(() => {
                            callback();
                        });
                    } else {
                        Logger.instance.debug(`Highest score found was ${bestMatchScore} with track name ${bestMatch.name}. This will be used`);
                    }

                    playedTrack.processed = true;
                    playedTrack.processedAt = new Date();
                    playedTrack.spotifyTrackId = bestMatch.id;
                    playedTrack.spotifyTrackUri = bestMatch.uri;
                    playedTrack.save((error) => {

                        if (error) {
                            Logger.instance.log('error', `failed to save played track`, error);
                            return callback();
                        }

                        new SpotifyTrack({
                            artist: playedTrack.artist,
                            track: bestMatch.name,
                            spotifyUri: bestMatch.uri,
                            spotifyId: bestMatch.id,
                            addedAt: new Date(),
                            extraData: bestMatch
                        }).save((error) => {
                            if (error) {
                                Logger.instance.log('error', `failed to save spotify track`, error['errors']);
                                return callback();
                            }

                            Logger.instance.info(`found track '${bestMatch.name}' by '${playedTrack.artist}' with spotifyUri: ${bestMatch.uri}`);
                            callback();
                        })
                    });
                });
            } else {
                Logger.instance.info('found in database');
                playedTrack.processed = true;
                playedTrack.processedAt = new Date();
                playedTrack.spotifyTrackId = spotifyTrack.spotifyId;
                playedTrack.spotifyTrackUri = spotifyTrack.spotifyUri;
                playedTrack.save((error) => {

                    if (error) {
                        Logger.instance.log('error', `failed to save played track`, error);
                        return callback();
                    }

                    Logger.instance.info('saved to the database');
                    callback();
                });
            }
        });

    }
}