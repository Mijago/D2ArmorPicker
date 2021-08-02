import {Pipe, PipeTransform} from '@angular/core';
import {MaxStatData} from "./main.component";

@Pipe({
  name: 'filterPossibleAmountSet'
})
export class FilterPossibleAmountSetPipe implements PipeTransform {

  transform(value: MaxStatData[], amount: number): MaxStatData[] {
    return value.filter(d => d[6] == amount) as MaxStatData[]
  }

}
