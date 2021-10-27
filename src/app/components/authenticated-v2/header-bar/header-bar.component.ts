import {Component, OnInit} from '@angular/core';
import {AuthService} from "../../../services/auth.service";
import {StatusProviderService} from "../../../services/status-provider.service";
import {InventoryService} from "../../../services/inventory.service";
import {environment} from "../../../../environments/environment";

@Component({
  selector: 'app-header-bar',
  templateUrl: './header-bar.component.html',
  styleUrls: ['./header-bar.component.css']
})
export class HeaderBarComponent implements OnInit {
  version = environment.version;

  constructor(private auth: AuthService, public status: StatusProviderService,
              private inv: InventoryService) {
  }

  ngOnInit(): void {
  }

  async refreshAll(b: boolean) {
    await this.inv.refreshAll(b)
  }

  logout() {
    this.auth.logout();
  }
}
