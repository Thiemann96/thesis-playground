import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as turf from '@turf/turf';

// a geolife user has multiple geolife trajectories and one id for identification
interface GeolifeUser {
  id: string;
  trajectories: Array<GeolifeTrajectory>;
}
interface GeolifeTrajectory {
  points: Array<Point>;
}
interface Point {
  coords: [number, number];
  dates: [string, string];
  speed?: number,
  acceleration?: number
}

@Injectable({
  providedIn: 'root',
})
export class GeolifeService {
  dataSource = './assets/data/GeoLifeTrajectories';

  constructor(private http: HttpClient) {}

  // loads all trajectories from assets and converts them to GeolifeUser Arrays
  public getAllTrajectories(): GeolifeUser {
    const trajectories = [];
    this.http
      .get('./assets/path.csv', { responseType: 'text' })
      .subscribe((data) => {
        const allPath = data.split('\n').map((path) => {
          return path.substring(56, path.length);
        });
        allPath.map((path) => {
          this.http.get(path, { responseType: 'text' }).subscribe((data) => {
            trajectories.push(this.parsePLTFile(data));
          });
        });
      });
    const user: GeolifeUser = {
      id: '000',
      trajectories,
    };
    return user;
  }

  // parses plt files and creates an object
  private parsePLTFile(fileContent: string): GeolifeTrajectory {
    let csvArray = [];
    // lat, lng, alti, date string, time string
    csvArray = fileContent.split('\n');
    csvArray.splice(0, 6);
    const points: Array<Point> = [];
    // map array and extract lats lngs for leaflet
    csvArray.map((point, index) => {
      if (index !== csvArray.length - 1){
        const pointArr = point.split(',');
        const pointToPush:Point = {
          coords: [pointArr[0], pointArr[1]],
          dates: [pointArr[5], pointArr[6]],
        }
        if(points.length === 0 ){
          points.push(pointToPush);
        }
        else{
          const previousPoint = points[index-1];
          let previousPreviousPoint;
          if(index > 2 ){ previousPreviousPoint = points[index-2];}
          const speed = this.getSpeed(previousPoint, pointToPush)
          if(speed < 150){
            pointToPush.speed = speed;
            if(index > 2){
              const acceleration = this.getAcceleration(previousPreviousPoint,pointToPush);
              if(true){
                pointToPush.acceleration = acceleration;
                points.push(pointToPush);
              }
              else {
                console.log("Acceleratin over threshold, discaridng point");
              }
            }
          }
          else {
            console.log("Speed over threshold, discarding point...");
          }
        }
      }
    });

    const trajectory: GeolifeTrajectory = { points };
    console.log(trajectory)
    return trajectory;
  }

  private filterNoise(trajectory): GeolifeTrajectory {
    const speedThreshold = 150;

    return;
  }

  private convertMsToHours(duration){
    const hours = (((duration / 1000) / 60) / 60);
    return hours;
  }

  private getSpeed(pointA, pointB): number{
    // calculates the speed between two points
    // takes PointA{coords,dates} & PointB{coords,dates} as input
    const from = turf.point(pointA.coords);
    const to = turf.point(pointB.coords);
    const distance = turf.distance(from, to, { units: 'kilometers' });

    const dateFrom: any = new Date(pointA.dates[0]);
    let timeArr = pointA.dates[1].split(':');
    dateFrom.setHours(timeArr[0], timeArr[1], timeArr[2]);

    const dateTo: any = new Date(pointB.dates[0]);
    timeArr = pointB.dates[1].split(':');
    dateTo.setHours(timeArr[0], timeArr[1], timeArr[2]);

    // convert to seconds, minutes, hours
    const elapsedTime = this.convertMsToHours(Math.abs(dateFrom - dateTo));

    // km per hour
    let speed = distance / elapsedTime
    return speed; 
  }

  private getAcceleration(pointA, pointC) {
    // over a 3 point window get the acceleration 
    // need: speed at point A, speed at point B, time taken
    // formula used : a = (velocity_final - velocity_initial) / duration
    const dateFrom: any = new Date(pointA.dates[0]);
    let timeArr = pointA.dates[1].split(':');
    dateFrom.setHours(timeArr[0], timeArr[1], timeArr[2]);

    const dateTo: any = new Date(pointC.dates[0]);
    timeArr = pointC.dates[1].split(':');
    dateTo.setHours(timeArr[0], timeArr[1], timeArr[2]);

    const elapsedTime = this.convertMsToHours(Math.abs(dateFrom - dateTo));

    const acceleration = (pointC.speed - pointA.speed) / elapsedTime
    return acceleration;
  }
}
