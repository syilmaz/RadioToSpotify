import * as mongoose from 'mongoose';

export interface ISpotifyAuthModel extends mongoose.Document {
    accessToken: string;
    refreshToken: string;
    refreshDate: Date;
}

export const SpotifyAuthSchema = new mongoose.Schema(<mongoose.SchemaDefinition> {
    accessToken: {
        type: String
    },
    refreshToken: {
        type: String
    },
    refreshDate: {
        type: Date
    }
});

export const SpotifyAuth = mongoose.model<ISpotifyAuthModel>('SpotifyAuth', SpotifyAuthSchema);
export default SpotifyAuth;