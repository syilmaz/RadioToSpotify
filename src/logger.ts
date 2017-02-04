import * as Winston from "winston";

const winstonInstance = new Winston.Logger()
    .add(Winston.transports.Console, <Winston.LoggerOptions> {
        level: "debug"
    });

export class Logger {
    public static instance:Winston.LoggerInstance = winstonInstance;
}