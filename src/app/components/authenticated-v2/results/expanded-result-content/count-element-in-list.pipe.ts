import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'count'
})
export class CountElementInListPipe implements PipeTransform {

  transform(value: any[], searchItem: any): number {
    return value.filter(d => d == searchItem).length
  }

}
