import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'count'
})
export class CountElementInListPipe implements PipeTransform {

  transform(value: any[], searchItem: any): number {
    console.log({value, searchItem}, value.filter(d => d == searchItem), value.filter(d => d == searchItem).length)
    return value.filter(d => d == searchItem).length
  }

}
