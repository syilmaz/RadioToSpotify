import { EventEmitter } from "events";
import {Logger} from "../logger";

export class Scheduler extends EventEmitter {

    private _scheduleTimeInMilliseconds:Number;
    private _timer:any;

    constructor(scheduleTimeInSeconds:Number) {
        super();
        this._scheduleTimeInMilliseconds = scheduleTimeInSeconds;
    }

    /**
     * Starts a timer which emits the "timer" event at the provided poll time.
     */
    public start():void {
        this.stop();
        this.emit("timer", this.run.bind(this));
    }

    private run():void {
        Logger.instance.info(`Scheduling next run in ${this._scheduleTimeInMilliseconds}ms`);

        this.stop();
        this._timer = setTimeout(() => {
            this.emit("timer", this.run.bind(this));
        }, this._scheduleTimeInMilliseconds);
    }

    /**
     * Stops the poller
     */
    public stop():void {
        if (this._timer) {
            clearTimeout(this._timer);
        }
    }

}