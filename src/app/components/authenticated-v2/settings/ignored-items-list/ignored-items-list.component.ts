import { Component, OnDestroy, OnInit } from "@angular/core";
import { ConfigurationService } from "../../../../services/configuration.service";
import { DatabaseService } from "../../../../services/database.service";
import { IInventoryArmor } from "../../../../data/types/IInventoryArmor";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-ignored-items-list",
    templateUrl: "./ignored-items-list.component.html",
    styleUrls: ["./ignored-items-list.component.scss"],
})
export class IgnoredItemsListComponent implements OnInit, OnDestroy {
    disabledItems: IInventoryArmor[] = [];

    constructor(private config: ConfigurationService, private db: DatabaseService) {}

    enableItem(instanceId: string) {
        this.config.modifyConfiguration((cb) => {
            cb.disabledItems.splice(cb.disabledItems.indexOf(instanceId), 1);
        });
    }

    generateTooltip(armor: IInventoryArmor) {
        return (
            "Click this icon to activate this item again.\r\n" +
            "" +
            armor.name +
            "  " +
            "" +
            (armor.mobility + (armor.masterworked ? 2 : 0)) +
            "/" +
            "" +
            (armor.resilience + (armor.masterworked ? 2 : 0)) +
            "/" +
            "" +
            (armor.recovery + (armor.masterworked ? 2 : 0)) +
            "/" +
            "" +
            (armor.discipline + (armor.masterworked ? 2 : 0)) +
            "/" +
            "" +
            (armor.intellect + (armor.masterworked ? 2 : 0)) +
            "/" +
            "" +
            (armor.strength + (armor.masterworked ? 2 : 0))
        );
    }

    ngOnInit(): void {
        this.config.configuration.pipe(takeUntil(this.ngUnsubscribe)).subscribe(async (cb) => {
            let items = [];
            for (let hash of cb.disabledItems) {
                let itemInstance = await this.db.inventoryArmor
                    .where("itemInstanceId")
                    .equals(hash)
                    .first();
                if (itemInstance) items.push(itemInstance);
            }
            this.disabledItems = items;
        });
    }

    private ngUnsubscribe = new Subject();

    ngOnDestroy() {
        this.ngUnsubscribe.next();
        this.ngUnsubscribe.complete();
    }
}
