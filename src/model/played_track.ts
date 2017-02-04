import * as mongoose from 'mongoose';
import {ObjectID} from "mongodb";

export interface IPlayedTrackModel extends mongoose.Document {
    stationId: ObjectID;
    artist: string;
    track: string;
    playedAt: Date;
    spotifyTrackId: string;
    spotifyTrackUri: string;
    processed: boolean;
    processedAt: Date;
    attempts: number;
}

export const PlayedTrackSchema = new mongoose.Schema(<mongoose.SchemaDefinition> {
    stationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Station',
        required: true
    },
    artist: {
        type: String,
        required: true
    },
    track: {
        type: String,
        required: true
    },
    playedAt: {
        type: Date,
        required: true
    },
    spotifyTrackId: String,
    spotifyTrackUri: String,
    processed: Boolean,
    processedAt: Date,
    attempts: Number
});

// A combination of these fields should be unique
PlayedTrackSchema.index({ stationId: 1, artist: 1, track: 1, playedAt: 1 }, { unique: true });

export const PlayedTrack = mongoose.model<IPlayedTrackModel>('PlayedTrack', PlayedTrackSchema);
export default PlayedTrack;