import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";
import { HttpClient, HttpHeaders } from "@angular/common/http";


@Injectable({
  providedIn: 'root'
})
export class DatamanagerService {

  constructor(private http: HttpClient) {}


  /** CHICAGO */

  public async getChicagoTrajectories() {
    const allPath = await this.getAllPathsDMCL();

    const promises = await allPath.map(async(path)=>{
      const data = await this.http
        .get(path, { responseType: "text" })
        .toPromise();
      return data;
    })
    let trajectories = await Promise.all(promises);
    const filtered = this.parseChicagoFile(trajectories);
  }

  private parseChicagoFile(fileContent){ 
    const csvArray = fileContent.map(t=>t.split("\n"))
    const finalResult = [];
    csvArray.map(trajectory=>
      {
        try {
          trajectory.map(t=>{
            if(t.length > 50 && t.length < 70 && trajectory.length !== 27){
              const splitArr = t.split("|");
              splitArr[0] = parseFloat(splitArr[0])/100;
              splitArr[1] = parseFloat(splitArr[1])/(-100);
              let dateToEdit = splitArr[2];  
              dateToEdit = parseFloat(dateToEdit.substring(0,3));
              if(dateToEdit < 0){
                dateToEdit += 24
                splitArr[2] = new Date(`January 01, 2000 ${dateToEdit + splitArr[2].substring(3, dateToEdit.length) }`)
                }
              else {
                splitArr[2] = new Date(`January 01, 2000 ${splitArr[2]}`)
  
              }
              splitArr.pop();
              splitArr.pop();
              finalResult.push(splitArr);
            }
  
          })
        } catch (error) {
            console.log(error,trajectory);
          }

      })
    console.log(finalResult)
  }

  private async getAllPathsDMCL(){
    const paths = await this.http
      .get('./assets/data/dmcl/allpaths.txt', {responseType:"text"})
      .toPromise();
    const allPath = paths.split("\n").map((path)=>{
      return path.substring(50,path.length);
    });

    return allPath;
  }



  /** GSM  */

  public async getGSMTrajectories(){
    const promises = await this.http
      .get("./assets/10837.csv", {responseType: "text"})
      .toPromise();
    const fileContent = this.parseGSMFile(promises);

    return fileContent;
  }

  private parseGSMFile(fileContent){
    let csv = fileContent.split("\n");
    const geojson = []
    csv.map(c=>{
      const pointArr = c.split(","); 
      const datetopush = new Date(pointArr[3])
      const pointToPush = turf.point([parseFloat(pointArr[2]), parseFloat(pointArr[1])],{date:datetopush})
      geojson.push(pointToPush);
    });
    return geojson;

  }

  /**GEOLIFE */
  public async getAllTrajectories(paths) {
    const allPath = await this.getAllPaths(paths);
    const promises = await allPath.map(async (path) => {
      const data = await this.http
        .get(path, { responseType: "text" })
        .toPromise();
      return data;
    });
    const trajectories = await Promise.all(promises);
    const finishedT = trajectories.map((t) => {
      const trajectory = this.parsePLTFile(t);
      return trajectory;
    });
    let filteredT:any = finishedT.map((t) => {
      return this.filterNoise(t);
    });
    
    filteredT = filteredT.map((t)=>{
      return turf.featureCollection(t);
    })
    return filteredT;
  }

  private async getAllPaths(path) {
    const paths = await this.http
      .get(`./assets/${path}`, { responseType: "text" })
      .toPromise();
    const allPath = paths.split("\n").map((path) => {
      // 50 oder 56
      return path.substring(50, path.length);
    });

    return allPath;
  }
  // parses plt files and creates an object
  private parsePLTFile(fileContent) {
    let csvArray = [];
    // lat, lng, alti, date string, time string
    csvArray = fileContent.split("\n");
    csvArray.splice(0, 6);
    const geojson = [];
    const coords = [];
    // map array and extract lats lngs for leaflet
    csvArray.map((point, index) => {
      if (index !== csvArray.length - 1) {
        const pointArr = point.split(",");
        try {
          const pointToPush = turf.point([parseFloat(pointArr[0]),parseFloat(pointArr[1])],{date:this.getDate(pointArr[5],pointArr[6])})
          geojson.push(pointToPush);
        } catch (error) {
        }
      }
    });
    return geojson;
  }



  /** HELPERS */


  private filterNoise(trajectory) {
    const speedThreshold = 150;
    const accThreshold = 15;
    const newArray = [];
    trajectory.map((point, index) => {
      if (index === 0) newArray.push(point);
      if (index > 1) {
        const { speed, distance } = this.getSpeed(
          trajectory[index - 1],
          trajectory[index]
        );
        if (speed < speedThreshold) {
          point.properties.speedKmH = speed;
          point.properties.distanceCoveredMeters = distance;
          if (index > 2) {
            const acceleration = this.getAcceleration(
              trajectory[index - 3],
              trajectory[index]
            );
            if (acceleration < accThreshold) {
              point.properties.acceleration = acceleration;
              newArray.push(point);
            } else {
              //console.log("Discarding point, too much acc");
            }
          } else {
            newArray.push(point);
          }
        } else {
          //console.log("Discarding point, too much speed");
        }
      }
    });
    return newArray;
  }

  private convertMsToHours(duration) {
    const hours = duration / 1000 / 60 / 60;
    return hours;
  }

  private getDate(dateString, timeString) {
    const dateFrom: any = new Date(dateString);
    let timeArr = timeString.split(":");
    dateFrom.setHours(timeArr[0], timeArr[1], timeArr[2]);

    return dateFrom;
  }

  private getSpeed(pointA, pointB) {
    // calculates the speed between two points
    // takes PointA{coords,dates} & PointB{coords,dates} as input    
    const distance = turf.distance(pointA, pointB, { units: "meters" });
    const distanceKm = turf.distance(pointA, pointB, { units: "kilometers" });
  
    // convert to seconds, minutes, hours
    const elapsedTime = this.convertMsToHours(
      Math.abs(pointA.properties.date - pointB.properties.date)
    );

    // km per hour
    let speed = distanceKm / elapsedTime;
    return { speed, distance };
  }

  private getAcceleration(pointA, pointC) {
    // over a 3 point window get the acceleration
    // need: speed at point A, speed at point B, time taken
    // formula used : a = (velocity_final_s - velocity_initials_s) / duration_s);
    // 15 m/s²
    // convert all values to meter and seconds
    const elapsedTime = Math.abs(pointA.properties.date - pointC.properties.date) / 1000;

    const speedInM = (speedInKmH) => {
      return (speedInKmH * 1000) / 60 / 60;
    };
    const acceleration =
      (speedInM(pointC.properties.speedKmH) - speedInM(pointA.properties.speedKmH)) / elapsedTime;
    return acceleration;
  }
}
