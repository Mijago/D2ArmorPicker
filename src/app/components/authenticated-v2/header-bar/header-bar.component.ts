import { Component, OnInit } from '@angular/core';
import {AuthService} from "../../../services/auth.service";
import {StatusProviderService} from "../../../services/v2/status-provider.service";

@Component({
  selector: 'app-header-bar',
  templateUrl: './header-bar.component.html',
  styleUrls: ['./header-bar.component.css']
})
export class HeaderBarComponent implements OnInit {

  constructor(private auth: AuthService, public status: StatusProviderService) { }

  ngOnInit(): void {
  }

  refreshAll(b: boolean) {
    // TODO
  }

  logout() {
    this.auth.logout();
  }
}
