import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'count'
})
export class CountElementInListPipe implements PipeTransform {

  transform(value: any[], searchItem: any = null): number {
    return value.filter(d => searchItem == null || d == searchItem).length
  }

}
