import * as mongoose from 'mongoose';

export interface ISpotifyTrackModel extends mongoose.Document {
    artist: string;
    track: string;
    spotifyUri: string;
    spotifyId: string;
    addedAt: Date;
    extraData: Object;
    analysis: Object;
}

export const SpotifyTrackSchema = new mongoose.Schema(<mongoose.SchemaDefinition> {
    artist: {
        type: String,
        required: true
    },
    track: {
        type: String,
        required: true
    },
    spotifyUri: String,
    spotifyId: String,
    addedAt: {
        type: Date,
        required: true
    },
    extraData: Object,
    analysis: Object
});

// A combination of these fields should be unique
SpotifyTrackSchema.index({ artist: 1, track: 1 }, { unique: true });

export const SpotifyTrack = mongoose.model<ISpotifyTrackModel>('SpotifyTrack', SpotifyTrackSchema);
export default SpotifyTrack;