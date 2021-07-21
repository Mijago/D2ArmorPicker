import {Component, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {AuthService} from "../../services/auth.service";

@Component({
  selector: 'app-handle-bungie-login',
  templateUrl: './handle-bungie-login.component.html',
  styleUrls: ['./handle-bungie-login.component.css']
})
export class HandleBungieLoginComponent implements OnInit {

  constructor(private activatedRoute: ActivatedRoute, private router: Router, private loginService: AuthService) {
  }

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(async (params) => {
      console.log(params['code'])
      this.loginService.authCode = params['code'];

      await this.loginService.generateTokens()

      await this.router.navigate(["/"]);
    });
  }

}
