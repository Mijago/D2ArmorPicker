import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {ISelectedExotic} from "../main/main.component";

@Component({
  selector: 'app-exotic-item-display',
  templateUrl: './exotic-item-display.component.html',
  styleUrls: ['./exotic-item-display.component.css']
})
export class ExoticItemDisplayComponent implements OnInit {

  @Input()
  item: ISelectedExotic | null = null;

  @Input()
  selected: boolean =false;


  @Output() onClick = new EventEmitter<number>();

  constructor() {
  }

  ngOnInit(): void {
  }

  click() {
    this.onClick.emit(this.item?.hash);
  }

}
