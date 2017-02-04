import * as mongoose from 'mongoose';

export interface IStationModel extends mongoose.Document {
    name: string;
    crawlUrl: string;
    crawlStrategy: string;
    nextCrawlDate: Date;
    spotifyPlaylistId: string;
    enabled: boolean;
}

export const StationSchema = new mongoose.Schema(<mongoose.SchemaDefinition> {
    name: {
        type: String,
        required: true
    },
    crawlUrl: {
        type: String,
        required: true
    },
    nextCrawlDate: {
        type: Date,
        required: true
    },
    crawlStrategy: {
        type: String,
        required: true
    },
    spotifyPlaylistId: {
        type: String,
        required: true
    },
    enabled: {
        "default": true,
        type: Boolean,
        required: true
    }
});

export const Station = mongoose.model<IStationModel>('Station', StationSchema);
export default Station;