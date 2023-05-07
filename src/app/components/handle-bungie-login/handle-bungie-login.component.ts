import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-handle-bungie-login",
  templateUrl: "./handle-bungie-login.component.html",
  styleUrls: ["./handle-bungie-login.component.css"],
})
export class HandleBungieLoginComponent implements OnInit {
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private loginService: AuthService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(async (params) => {
      let code = params["code"];
      if (window.location.search.indexOf("?code=") > -1) code = window.location.search.substr(6);

      console.info({ code });

      if (!code) return;

      this.loginService.authCode = code;

      console.info("Generate tokens with the new code");
      await this.loginService.generateTokens();

      console.info("Now navigate to /");
      await this.router.navigate(["/"]);
    });
  }
}
