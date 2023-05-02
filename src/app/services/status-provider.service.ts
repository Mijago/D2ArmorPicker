import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

export interface Status {
    calculatingPermutations: boolean;
    calculatingResults: boolean;
    updatingResultsTable: boolean;
    updatingManifest: boolean;
    updatingInventory: boolean;
}

@Injectable({
    providedIn: "root",
})
export class StatusProviderService {
    private __status: Status = {
        calculatingResults: false,
        calculatingPermutations: false,
        updatingResultsTable: false,
        updatingInventory: false,
        updatingManifest: false,
    };

    private _status: BehaviorSubject<Status>;
    public readonly status: Observable<Status>;

    constructor() {
        this._status = new BehaviorSubject<Status>(this.__status);
        this.status = this._status.asObservable();
    }

    getStatus() {
        return this.__status;
    }

    modifyStatus(cb: (status: Status) => void) {
        cb(this.__status);
        console.log("modifyStatus", this.__status);
        this._status.next(this.__status);
    }
}
