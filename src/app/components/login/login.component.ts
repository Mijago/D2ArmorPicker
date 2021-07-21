import { Component, OnInit } from '@angular/core';
import {AuthService} from "../../services/auth.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  constructor(private loginService: AuthService) { }

  ngOnInit(): void {
  }

  startLogin() {
    window.location.href= "https://www.bungie.net/en/OAuth/Authorize?client_id=34392&response_type=code"
  }

}
