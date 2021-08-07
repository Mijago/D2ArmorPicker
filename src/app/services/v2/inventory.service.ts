import {Injectable} from '@angular/core';
import {CharacterClass} from "../../data/enum/character-Class";
import {DatabaseService, IManifestArmor} from "../database.service";

@Injectable({
  providedIn: 'root'
})
export class InventoryService {

  constructor(private db: DatabaseService) {
  }

  async getExoticsForClass(clazz: CharacterClass, slot?: string): Promise<Array<IManifestArmor>> {
    return this.db.manifestArmor
      .where("clazz").equals(clazz)
      .and(d => d.armor2)
      .and(d => d.isExotic)
      .and(d => !slot || d.slot == slot)
      .toArray();
  }
}
