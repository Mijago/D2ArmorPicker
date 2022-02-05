import {Injectable} from '@angular/core';
import {AuthService} from "./auth.service";
import {BungieApiService} from "./bungie-api.service";
import {InventoryService} from "./inventory.service";
import {DestinyClass} from "bungie-api-ts/destiny2/interfaces";

@Injectable({
  providedIn: 'root'
})
export class UserdataService {
  public characters: any[] | { emblemUrl: string; characterId: string; clazz: DestinyClass; lastPlayed: number }[] = [];

  constructor(private auth: AuthService, private api: BungieApiService, private inventory: InventoryService) {
    this.loadCachedData();

    auth.logoutEvent.subscribe(k => this.clearCachedData())

    this.inventory.inventory.subscribe(async () => {
        await this.updateCharacterData();
      }
    )
  }

  public clearCachedData() {
    this.characters = []
    localStorage.removeItem("cachedCharacters")
  }

  private loadCachedData() {
    let item = localStorage.getItem("cachedCharacters") || "[]";
    this.characters = JSON.parse(item)
  }

  private async updateCharacterData() {
    this.characters = await this.api.getCharacters();
    localStorage.setItem("cachedCharacters", JSON.stringify(this.characters))
  }
}

