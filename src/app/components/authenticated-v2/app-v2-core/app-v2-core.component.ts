import {Component, OnInit} from '@angular/core';
import {StatusProviderService} from "../../../services/status-provider.service";
import {Observable} from "rxjs";
import {BreakpointObserver, Breakpoints} from "@angular/cdk/layout";
import {map, shareReplay} from "rxjs/operators";
import {InventoryService} from "../../../services/inventory.service";
import {AuthService} from "../../../services/auth.service";
import {NavigationEnd, Router} from "@angular/router";
import {environment} from "../../../../environments/environment";
import {ChangelogService} from "../../../services/changelog.service";

@Component({
  selector: 'app-app-v2-core',
  templateUrl: './app-v2-core.component.html',
  styleUrls: ['./app-v2-core.component.css']
})
export class AppV2CoreComponent implements OnInit {
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
    {
      link: "/investigate",
      name: "Armor Investigation"
    },
  ]

  constructor(public status: StatusProviderService, private breakpointObserver: BreakpointObserver,
              private inv: InventoryService, private auth: AuthService, private router: Router,
              public changelog: ChangelogService) {
  }

  isHandset$: Observable<boolean> = this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.Small, Breakpoints.XSmall])
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  ngOnInit(): void {
    this.activeLinkIndex = this.navLinks.indexOf(this.navLinks.find(tab => tab.link === this.router.url) as any);

    this.router.events.subscribe((res) => {
      if (res instanceof NavigationEnd)
        this.activeLinkIndex = this.navLinks.indexOf(this.navLinks.find(tab => tab.link === this.router.url) as any);
    });
  }

  async refreshAll(b: boolean) {
    console.debug("Trigger refreshAll due to button press")
    await this.inv.refreshAll(b)
  }

  logout() {
    this.auth.logout();
  }


}
