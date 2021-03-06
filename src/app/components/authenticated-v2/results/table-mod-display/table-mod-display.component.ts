import {Component, Input, OnInit} from '@angular/core';

@Component({
  selector: 'app-table-mod-display',
  templateUrl: './table-mod-display.component.html',
  styleUrls: ['./table-mod-display.component.css']
})
export class TableModDisplayComponent implements OnInit {

  @Input()
  url: string = "";
  @Input()
  tooltipText: string = "";
  @Input()
  isMinorMod: boolean = false;

  @Input()
  amount: number = 0;
  constructor() { }

  ngOnInit(): void {
  }

}
