import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private http: HttpClient) {}

  getResultList() {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
      return this.http.get('./assets/search.json', {headers});
  }
}
