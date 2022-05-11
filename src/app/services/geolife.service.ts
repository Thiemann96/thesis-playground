import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as turf from "@turf/turf";
import { FeatureCollection } from "@turf/turf";

// a geolife user has multiple geolife trajectories and one id for identification
interface GeolifeUser {
  id: string;
  trajectories: Array<GeolifeTrajectory>;
}
interface GeolifeTrajectory {
  points: Array<Point>;
}
interface Point {
  lat: number;
  lng: number;
  date: Date;
  speedKmH?: number;
  distanceCoveredMeters?: number;
  acceleration?: number;
}

interface StayPoint {
  meanLatitude: number;
  meanLongitude: number;
  arrivalTime: number;
  leaveTime: number;
}

@Injectable({
  providedIn: "root",
})
export class GeolifeService {
  constructor(private http: HttpClient) {}

  // loads all trajectories from assets and converts them to GeolifeUser Arrays
  public async getAllTrajectories() {
    const allPath = await this.getAllPaths();
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
    const filteredT = finishedT.map((t) => {
      return this.filterNoise(t);
    });
    const user = {
      id: "000",
      filteredT,
    };
    return user;
  }

  private async getAllPaths() {
    const paths = await this.http
      .get("./assets/path.csv", { responseType: "text" })
      .toPromise();
    const allPath = paths.split("\n").map((path) => {
      return path.substring(56, path.length);
    });

    return allPath;
  }
  // parses plt files and creates an object
  private parsePLTFile(fileContent) {
    let csvArray = [];
    // lat, lng, alti, date string, time string
    csvArray = fileContent.split("\n");
    csvArray.splice(0, 6);
    const points: Array<Point> = [];
    // map array and extract lats lngs for leaflet
    csvArray.map((point, index) => {
      if (index !== csvArray.length - 1) {
        const pointArr = point.split(",");
        const pointToPush: Point = {
          lat: parseFloat(pointArr[0]),
          lng: parseFloat(pointArr[1]),
          date: this.getDate(pointArr[5], pointArr[6]),
        };
        points.push(pointToPush);
      }
    });
    return points;
  }



  public cleanArray(stayPoints) {
    const pointArray = [];
    stayPoints.map((point) => {
      point.map((realPoint) => {
        pointArray.push(realPoint);
      });
    });
    return pointArray;
  }
  // stay point for one trajectory ok,
  // apply stay points to global map of the user (i.e. only show all stay points on the map)
  // iterate over all paths extract y points and show all stay points with popup on the map
  // after: implement OPTICS algorithm
  public convertStaypointsToGEOJSON(staypoints){
    const turfPoints = [];
    staypoints.map((point) => {
      const turfPoint = turf.point([point.meanLongitude, point.meanLatitude], {
        arrival: point.arrivalTime,
        leave: point.leaveTime,
      });
      turfPoints.push(turfPoint);
    });

    return turfPoints;
  }
  public clusterStaypoints(staypoints, distance, options) {
    const collection = turf.featureCollection(this.convertStaypointsToGEOJSON(staypoints));
    const clustered = turf.clustersDbscan(collection, distance,{mutate:true});

    return clustered;
  }
  public clusterOptics(stayPoints) {
    console.log(stayPoints);
    /**
     * Notes on OPTICS clustering
     *
     * needs as input:
     *      core distance : minimum value of radius to classify point as core point, if no core point => core distance = undefined
     *      minPts : minimum number of points a core point should have
     *      List of points (db)
     */
  }

  t;
  public extractStayPoints(trajectory, timeThreshold, distThreshold) {
    const stayPoints = [];
    const stayPointsCenter = [];
    let i = 0;
    while (i < trajectory.length) {
      let j = i + 1;
      while (j < trajectory.length) {
        const pointA = turf.point([trajectory[j].lat, trajectory[j].lng]);
        const pointB = turf.point([trajectory[i].lng, trajectory[i].lng]);
        const distance = turf.distance(pointA, pointB, { units: "meters" });
        if (distance > distThreshold) {
          const deltaTime = (trajectory[j].date - trajectory[i].date) / 60000; // convert to minutes
          if (deltaTime > timeThreshold) {
            let features = turf.points([
              [trajectory[j].lat, trajectory[j].lng],
              [trajectory[i].lat, trajectory[i].lng],
            ]);
            const center = this.computeMeanCoordinate(
              trajectory[j].lat,
              trajectory[j].lng,
              trajectory[i].lat,
              trajectory[i].lng
            );
            const sp: StayPoint = {
              meanLatitude: center[0],
              meanLongitude: center[1],
              arrivalTime: trajectory[i].date,
              leaveTime: trajectory[j].date,
            };
            stayPoints.push(sp);
          }
          break;
        }
        j = j + 1;
      }
      i = j;
    }
    return stayPoints;
  }

  private computeMeanCoordinate(latA, lngA, latB, lngB): Array<number> {
    const lats = latA + latB;
    const lons = lngA + lngB;

    const meanCoords = [lats / 2, lons / 2];
    return meanCoords;
  }

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
          point.speedKmH = speed;
          point.distanceCoveredMeters = distance;
          if (index > 2) {
            const acceleration = this.getAcceleration(
              trajectory[index - 3],
              trajectory[index]
            );
            if (acceleration < accThreshold) {
              point.acceleration = acceleration;
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
    const from = turf.point([pointA.lat, pointA.lng]);
    const to = turf.point([pointB.lat, pointB.lng]);
    const distance = turf.distance(from, to, { units: "meters" });
    const distanceKm = turf.distance(from, to, { units: "kilometers" });

    // convert to seconds, minutes, hours
    const elapsedTime = this.convertMsToHours(
      Math.abs(pointA.date - pointB.date)
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
    const elapsedTime = Math.abs(pointA.date - pointC.date) / 1000;

    const speedInM = (speedInKmH) => {
      return (speedInKmH * 1000) / 60 / 60;
    };
    const acceleration =
      (speedInM(pointC.speedKmH) - speedInM(pointA.speedKmH)) / elapsedTime;
    return acceleration;
  }
}
