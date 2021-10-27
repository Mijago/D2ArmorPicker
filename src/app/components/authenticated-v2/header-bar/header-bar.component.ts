import {Component, OnInit} from '@angular/core';
import {AuthService} from "../../../services/auth.service";
import {StatusProviderService} from "../../../services/status-provider.service";
import {InventoryService} from "../../../services/inventory.service";
import {environment} from "../../../../environments/environment";
import {NavigationEnd, Router} from "@angular/router";

@Component({
  selector: 'app-header-bar',
  templateUrl: './header-bar.component.html',
  styleUrls: ['./header-bar.component.css']
})
export class HeaderBarComponent implements OnInit {
  version = environment.version;

  activeLinkIndex = 0;
  navLinks = [
    {
      link: "/",
      name: "Home"
    },
    {
      link: "/cluster",
      name: "Clustering"
    },
    {
      link: "/help",
      name: "Help"
    },
  ]

  constructor(private auth: AuthService, public status: StatusProviderService,
              private inv: InventoryService, private router: Router) {

  }

  ngOnInit(): void {
    console.log("OAKJSDOIAJIOHJSDO ON INIT");
    this.activeLinkIndex = this.navLinks.indexOf(this.navLinks.find(tab => tab.link === this.router.url) as any);

    this.router.events.subscribe((res) => {
      console.log(res)
      if (res instanceof NavigationEnd)
        this.activeLinkIndex = this.navLinks.indexOf(this.navLinks.find(tab => tab.link === this.router.url) as any);
    });
  }

  async refreshAll(b: boolean) {
    await this.inv.refreshAll(b)
  }

  logout() {
    this.auth.logout();
  }
}
