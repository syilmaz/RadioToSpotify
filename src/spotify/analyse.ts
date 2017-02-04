import { Scheduler } from "../scheduler";
import { Logger } from "./../logger";
import { SpotifyTrack, ISpotifyTrackModel } from "../model/spotify_track";

import {Api} from "./api";
import {ValidationError} from "mongoose";

const SCHEDULE_TIME = 60 * 60 * 1000;
const MAX_IDS_TO_ANALYSE = 100;

export class SpotifyAnalyse {
    private scheduler: Scheduler;

    constructor() {
        this.scheduler = new Scheduler(SCHEDULE_TIME);
        this.scheduler.on("timer", this.updateTracksWithAnalysis.bind(this));
    }

    public start():void {
        Logger.instance.info(`Starting schedules with a delay of ${SCHEDULE_TIME}ms`);
        this.scheduler.start();
    }

    public updateTracksWithAnalysis():void {

        SpotifyTrack.find({
            analysis: {$exists: false}
        }, (error, results) => {

            if (error) {
                Logger.instance.log('error', 'failed to find spotify tracks', error);
                return;
            }

            if (results.length === 0) {
                Logger.instance.info('No tracks to analyse');
                return;
            }

            Logger.instance.info(`Found ${results.length} tracks to analyse`);

            if (results.length > MAX_IDS_TO_ANALYSE)  {
                Logger.instance.info(`We can only analyse ${MAX_IDS_TO_ANALYSE} tracks at once. The current number of tracks exceed this. Will do paginated`);
            }

            let items = [];

            for (let i = 0; i < results.length; i += MAX_IDS_TO_ANALYSE) {
                items.push(results.slice(i, i + MAX_IDS_TO_ANALYSE));
            }

            this.analyseBatchItems(items, (error) => {
                Logger.instance.info('Done analysing current batch');
            });
        });

    }

    private analyseBatchItems(items:any[], callback): void {

        if (items.length === 0) {
            return callback();
        }

        this.analyseTracks(items.shift(), () => {
            if (items.length > 0) {
                Logger.instance.debug('Finished analysing batch');
                return this.analyseBatchItems(items, callback);
            }

            callback();
        });
    }

    private analyseTracks(results: ISpotifyTrackModel[], callback): void {

        let spotifyIds = [];
        for (let i = 0; i < results.length; i++) {
            spotifyIds.push(results[i].spotifyId);
        }

        Api.getAudioFeaturesForTracks(spotifyIds, (error, data) => {
            if (error) {
                Logger.instance.log('error', 'failed to retrieve audio features', error);
                return callback();
            }

            if (!data.body || !data.body.audio_features || data.body.audio_features.length === 0) {
                Logger.instance.log('error', 'Didnt receive anything');
                return callback();
            }

            for (let i = 0; i < data.body.audio_features.length; i++) {
                let audioFeature = data.body.audio_features[i];
                this.saveAudioFeature(audioFeature.id, audioFeature);
            }

            callback();
        });
    }

    private saveAudioFeature(spotifyTrackId:String, analysis:any):void {
        SpotifyTrack.find({
            spotifyId: spotifyTrackId
        }, (error, tracks:ISpotifyTrackModel[]) => {

            if (error || tracks === null || tracks.length == 0) {
                Logger.instance.log('error', 'failed to find spotify track', error);
                return;
            }

            for (let i = 0; i < tracks.length; i++) {
                let track = tracks[i];

                track.analysis = analysis;
                track.save((error) => {

                    if (error) {
                        Logger.instance.log('error', 'failed to save spotify track', error);
                        return;
                    }

                    Logger.instance.info('Saved analysis');
                });
            }
        });
    }
}