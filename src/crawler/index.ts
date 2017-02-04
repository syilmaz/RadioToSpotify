import { Scheduler } from "./../scheduler";
import { Logger } from "./../logger";
import { IStationModel, Station } from "../model/station";
import { Playlist24 } from "./strategy/playlist24";

import * as Request from "request";
import {IPlayedTrackModel} from "../model/played_track";

const SCHEDULE_TIME = 5 * 60 * 1000;

export class Crawler {

    private scheduler: Scheduler;

    constructor() {
        this.scheduler = new Scheduler(SCHEDULE_TIME);
        this.scheduler.on("timer", this.crawlStations.bind(this));
    }

    public start():void {
        Logger.instance.info(`Starting scheduler with a delay of ${SCHEDULE_TIME}ms`);
        this.scheduler.start();
    }

    private crawlStations(doneCallback:Function):void {

        Logger.instance.info("Retrieving crawlable stations");

        Station.find({
            enabled: true,
            nextCrawlDate: {
                $lte: new Date()
            }
        }, (error, results) => {

            if (error) {
                Logger.instance.log("error", "Failed to retrieve crawlable stations", error);
                return;
            }

            Logger.instance.info("Num crawlable stations: " + results.length);
            this.startCrawlingStations(results, () => {
                Logger.instance.info("Finished crawling all stations");
                doneCallback();
            });
        });
    }

    private startCrawlingStations(stations:IStationModel[], callback:Function):void {
        let station:IStationModel = stations.shift();
        this.crawlStation(station, () => {
            // Nothing else to crawl
            if (stations.length === 0) {
                callback();
                return;
            }

            this.startCrawlingStations(stations, callback);
        });
    }

    private crawlStation(station:IStationModel, callback:Function):void {
        Logger.instance.info("Start crawling station with name: " + station.name);

        Request.get(station.crawlUrl, (error, response, body) => {

            if (error) {
                Logger.instance.log("error", `Failed to retrieve station ${station.name} with url: '${station.crawlUrl}'`);
                return callback();
            }

            Logger.instance.debug(`received data length=${body.length}`);
            let tracks:IPlayedTrackModel[] = Playlist24.getTracksForStation(station, body);

            Logger.instance.info(`identified ${tracks.length} tracks`);

            let saveTrack = function(track:IPlayedTrackModel, finishedSavingCb:Function) {
                track.save((error) => {
                    if (error) {
                        if (error.code !== 11000 /* Duplicate keys */) {
                            Logger.instance.log('error', `failed to save played track for station ${station.name}`, error);
                        }

                        finishedSavingCb(false);
                    } else {
                        finishedSavingCb(true);
                    }
                });
            };

            let newTracks = 0;
            let i = 0;
            let saveTracks = function() {
                if (i < tracks.length) {
                    saveTrack(tracks[i++], (isNewTrack:boolean) => {
                        if (isNewTrack) {
                            ++newTracks;
                        }

                        saveTracks();
                    });
                } else {
                    Logger.instance.info(`discovered ${newTracks} new tracks`);
                    callback();
                }
            };

            saveTracks();
        });
    }
}