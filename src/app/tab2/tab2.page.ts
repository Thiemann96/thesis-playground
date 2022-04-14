import { Component, OnInit } from '@angular/core';
import { SearchService } from '../search.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page implements OnInit{

  results:any = [];
  searchResults:any = [];
  tags:any = ['des','des2']

  constructor( private searchService: SearchService) {}

  ngOnInit(): void {
      this.getSearchResults();
  }

  getSearchResults(): void {
    this.searchService.getResultList()
      .subscribe(sr => {
        Object.assign(this.searchResults, sr);
      })
  }

  searchOnKeyUp(event) {
    let input = event.target.value;
    if(input.length > 1){
      this.results = this.searchFromArray(this.searchResults, input);
    }
  }

  submit(event){
    console.log(event);
    let input = event.target.value;
    this.tags.push(input);
  }

  searchFromArray(arr, regex) {
    let matches = [], i;
    for(i = 0; i < arr.length;i++){
      if(arr[i].match(regex)){
        matches.push(arr[i]);
      }
    }
    return matches;
  }
}
