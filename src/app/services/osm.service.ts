import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";
import { element } from 'protractor';


@Injectable({
  providedIn: 'root'
})
export class OsmService {


  dining:Array<string>= ["fast_food","bar","biergarten","cafe","food_court","ice_cream","pub","restaurant"];
  entertainment:Array<string> = ["arts_centre","brothel","casino","cinema","community_centre","conference_centre","events_venue","fountain","gambling","love_hotel","nightclub","planetarium","public_bookcase","social_centre","stripclub","studio","swingerclub","theatre"];
  healthcare:Array<string> = ["baby_hatch","clinic","dentist","doctors","hospital","nursing_home","pharmacy","social_facility","veterinary"];
  education:Array<string> =["college","driving_school","kindergarten","language_school","library","toy_library","music_school","school","university"]

  overpassAPI:string = "https://overpass.kumi.systems/api/interpreter"
  constructor(private http: HttpClient) { }



  private async getAroundCoordinate(centroid) {
    // https://www.openstreetmap.org/query?lat=40.0086&lon=116.4684
    const lat = centroid.geometry.coordinates[1];
    const lng = centroid.geometry.coordinates[0];

    const aroundDistance = 150;

    const dining_tags = this.getAllTags(this.dining);
    const entertainment_tags = this.getAllTags(this.entertainment)
    const healthcare_tags = this.getAllTags(this.healthcare)
    const education_tags = this.getAllTags(this.education)
    // check if nodes are around the given coordinate 
    // right now is checking for node AND relations 
    // further testing to see if we can just choose nodes 
    const body = `[timeout:10][out:json];
                (
                nwr["amenity"~"${dining_tags}"](around:${aroundDistance},${lat},${lng});
                nwr["amenity"~"${entertainment_tags}"](around:${aroundDistance},${lat},${lng});
                nwr["amenity"~"${healthcare_tags}"](around:${aroundDistance},${lat},${lng});
                nwr["amenity"~"${education_tags}"](around:${aroundDistance},${lat},${lng});
                );out qt;`

    const info:any = await this.http
      .post(this.overpassAPI, body, {
        responseType: "text",
      })
      .toPromise();
    const jsonInfo = JSON.parse(info);
    return jsonInfo

  }

  public async classifyCluster(cluster){
    const osmInfo:any = await this.getAroundCoordinate(cluster.centroid);
    const osmElements:any = osmInfo.elements.filter(element=>element.type === "node");
    const pointArray = [];
    let category = "misc";
    if(osmElements.length>1){
      osmElements.map(element=>{
          const point = turf.point([element.lon, element.lat], {category : element.tags.amenity});
          pointArray.push(point);        }
    )

    let nearestPoint = null; 
    pointArray.map(p=>{
      if (nearestPoint === null){nearestPoint = p}
      else {
        const distance = turf.distance(cluster.centroid, p);
        const distanceBefore = turf.distance(cluster.centroid, nearestPoint);
        if(distance < distanceBefore) { nearestPoint = p }
      }
    })
    category =  nearestPoint.properties.category;
    }

    cluster.category = category; 
    return cluster;
  }

  private getAllTags(tagArray:Array<string>){
    let outputString:string = ""; 
    for (let index = 0; index < tagArray.length; index++) {
      const element:string = tagArray[index];
      if(index === tagArray.length) {outputString + element}
      else
      {
        outputString = outputString + element + "|"
      } 
    }
    return outputString;
  }

}
