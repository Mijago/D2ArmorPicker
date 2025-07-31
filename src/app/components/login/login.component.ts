/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Component, OnDestroy, OnInit } from "@angular/core";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.css"],
})
export class LoginComponent implements OnInit, OnDestroy {
  currentSlide = 0;
  private autoScrollInterval: any;
  private readonly autoScrollDelay = 4000; // 4 Sekunden

  carouselItems = [
    {
      image: "/assets/carousel/stat-select.png",
      title: "Stat Optimization",
      subtitle: "Optimize your Guardian's stats as you see fit.",
    },
    {
      image: "/assets/carousel/result-overview.png",
      title: "Result Overview",
      subtitle: "Get a clear overview of the possible results with your gear.",
    },
    {
      image: "/assets/carousel/result-detail.png",
      title: "Detailed Breakdown",
      subtitle:
        "See a detailed breakdown of how a specific combination can reach your desired stats.",
    },
  ];

  constructor() {}

  ngOnInit() {
    this.startAutoScroll();
  }

  ngOnDestroy() {
    this.stopAutoScroll();
  }

  startAutoScroll() {
    this.autoScrollInterval = setInterval(() => {
      this.nextSlide();
    }, this.autoScrollDelay);
  }

  stopAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  pauseCarousel() {
    this.stopAutoScroll();
  }

  resumeCarousel() {
    this.startAutoScroll();
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.carouselItems.length;
  }

  goToSlide(index: number) {
    this.currentSlide = index;
  }

  startLogin() {
    window.location.href = `https://www.bungie.net/en/OAuth/Authorize?client_id=${environment.clientId}&response_type=code&reauth=true`;
  }
}
