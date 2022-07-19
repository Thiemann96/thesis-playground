import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OsmService {

  constructor(private http: HttpClient) { }


  public async getOSMInfo(coordinates) {
    // https://www.openstreetmap.org/query?lat=40.0086&lon=116.4684

    const xmlRequest = `<union>
    <bbox-query s="${coordinates[1]}" w="${coordinates[0]}" n="${coordinates[3]}" e="${coordinates[2]}"/>
    <recurse type="relation-relation"/>
  </union>
  <print mode="tags"/>`;

    const headers = new HttpHeaders()
      .set("Content-Type", "application/xml")
      .set("Accept", "application/xml")
      .set("Response-Type", "text");

    const info = await this.http
      .post("https://lz4.overpass-api.de/api/interpreter", xmlRequest, {
        responseType: "text",
      })
      .toPromise();
    return info;
  }

}
