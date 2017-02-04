import {IStationModel} from "../../model/station";
import {Logger} from "../../logger";

import * as Cheerio from "cheerio";
import * as _ from "lodash";
import * as moment from "moment-timezone";
import {IPlayedTrackModel, PlayedTrack} from "../../model/played_track";

export class Playlist24 {

    public static getTracksForStation(station: IStationModel, body: any):IPlayedTrackModel[] {

        let $ = Cheerio.load(body);
        let trackBlocks = $('.track-block');

        if (trackBlocks.length === 0) {
            Logger.instance.error("Failed to retrieve table");
            return [];
        }

        let tracks: IPlayedTrackModel[] = [];

        // Skip the first item since it only contains the header titles
        for (let i = 1; i < trackBlocks.length; i++) {
            let tableBlock:CheerioElement = trackBlocks[i];

            let dateTimeString:String = _.trim($(tableBlock).find('.time.square-box-date').text());
            let trackString:String = _.trim($(tableBlock).find('.text-overflow .title a').text());
            let artistString:String = _.trim($(tableBlock).find('.text-overflow .artist a').text());
            let playedAt:Date = moment
                .tz(moment().format('YYYY-MM-DD') + ` ${dateTimeString}`, 'Europe/Amsterdam')
                .toDate();

            tracks.push(new PlayedTrack({
                stationId: station._id,
                playedAt: playedAt,
                track: trackString,
                artist: artistString
            }));
        }

        return tracks;
    }
}