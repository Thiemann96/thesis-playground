import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
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
  optics_points:Array<any> = []; 
  priorityQ: Array<any> = [];
  constructor(private http: HttpClient) {}

  // loads all trajectories from assets and converts them to GeolifeUser Arrays
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
    const filteredT = finishedT.map((t) => {
      return this.filterNoise(t);
    });
    const user = {
      id: "000",
      filteredT,
    };
    return user;
  }

  private async getAllPaths(des) {
    const paths = await this.http
      .get(`./assets/${des}`, { responseType: "text" })
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
    const points: Array<Point> = [];
    // map array and extract lats lngs for leaflet
    csvArray.map((point, index) => {
      if (index !== csvArray.length - 1) {
        const pointArr = point.split(",");
        try {
          const pointToPush: Point = {
            lat: parseFloat(pointArr[0]),
            lng: parseFloat(pointArr[1]),
            date: this.getDate(pointArr[5], pointArr[6]),
          };
          points.push(pointToPush);
        } catch (error) {
          console.log(csvArray, error);
        }
      }
    });
    return points;
  }

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
  public convertStaypointsToGEOJSON(staypoints) {
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
    const collection = turf.featureCollection(
      this.convertStaypointsToGEOJSON(staypoints)
    );
    const clustered = turf.clustersDbscan(collection, distance, {
      mutate: true,
    });

    return clustered;
  }

  //
  public async clusterOptics(stayPoints, eps, minPts) {
    const orderedList = []; 
    this.priorityQ = [];
    // to geojson
    const geojsons = stayPoints.map((staypoint,index) => {
      return turf.point([staypoint.meanLongitude, staypoint.meanLatitude], {
        arrivalTime: staypoint.arrivalTime,
        leaveTime: staypoint.leaveTime,
        id: index
      });
    });

    const that = this;
    console.log("before",geojsons);
    this.optics_points = geojsons;
    for(let j = 0; j < this.optics_points.length; j++){
      const point = this.optics_points[j];
      // point.properties.reachability_distance = undefined; 
      if(!point.properties.processed){
        const neighbours = this.getNeighbours( point, eps);
        point.properties.processed = true; 
        orderedList.push(point);
        const coreDistance = this.getCoreDistance(point, eps, minPts);
        if(coreDistance !== undefined){
            this.updateOPTICS(neighbours, point, eps, minPts)
            for(let i = 0; i < this.priorityQ.length; i++){
              const queuedPoint = this.priorityQ[i]
              if(!queuedPoint.properties.processed){
                const neighbours_alt = that.getNeighbours(queuedPoint, eps);
                queuedPoint.properties.processed = true;
                orderedList.push(queuedPoint);
                const coreDistanceAlt = that.getCoreDistance(queuedPoint, eps, minPts);
                if(coreDistanceAlt !== undefined){
                  that.updateOPTICS(neighbours_alt, queuedPoint, eps, minPts);
                }
              }
            }

        }
      }
    }
    console.log("after",orderedList)

  }

  private updateOPTICS(neighbours, pt, eps, minPts){
    const coreDistance = this.getCoreDistance(pt, eps, minPts)
    const that = this; 
    for(let k = 0; k < neighbours.length; k++){
      let otherPoint = neighbours[k];
      if(!otherPoint.properties.processed) {
        console.log("smi")
        const new_distance = turf.distance(pt.geometry.coordinates, otherPoint.geometry.coordinates)
        const new_reachability_distance = Math.max(coreDistance, new_distance);
        if(otherPoint.properties.reachability_distance === undefined){
          otherPoint.properties.reachability_distance = new_reachability_distance;
          that.insertQElement(otherPoint);
        }
        else{
          if(new_reachability_distance < otherPoint.properties.reachability_distance){
            otherPoint.properties.reachability_distance = new_reachability_distance;
            that.removeQElement(otherPoint);
            that.insertQElement(otherPoint);
          }
        }
      }
    }
  }

  private getNeighbours( pt, eps) {
    const neighbours = this.optics_points.filter((point) => {
      const distance = turf.distance(pt.geometry.coordinates, point.geometry.coordinates, {units:"meters"});
      if (distance <= eps) return point;
    });
    return neighbours
  }

  private getCoreDistance(pt, eps, minPts){
    const neighbours = this.getNeighbours(pt , eps)
    let minDistance = undefined; 
    if(neighbours.length >= minPts){
        minDistance = eps;
        neighbours.forEach(function(otherPoint, index){
          if(pt !== otherPoint){
            const distance = turf.distance(pt.geometry.coordinates, otherPoint.geometry.coordinates,{units:"meters"})
            if(distance < minDistance){
                minDistance = distance; 
            }
          }
        })
    }
    return minDistance; 
  }
  // according to here https://www.geeksforgeeks.org/implementation-priority-queue-javascript/
  private removeQElement(point){
    for(let i = 0; i < this.priorityQ.length;i++){
      if(this.priorityQ[i] === point){
        const firstQPart = this.priorityQ.slice(0,i);
        const secondQPart = this.priorityQ.slice(i+1, this.priorityQ.length);
        this.priorityQ = firstQPart.concat(secondQPart);
        break;
      }
    }
  }
  
  // according to here https://www.geeksforgeeks.org/implementation-priority-queue-javascript/
  private insertQElement(point){
    let contain = false;
    for(let i = 0; i < this.priorityQ.length; i++){
      if(this.priorityQ[i].properties.reachability_distance > point.properties.reachability_distance){
        this.priorityQ.splice(i, 0, point);
        contain = true;
        break;
      }
    }
    if(!contain){
      this.priorityQ.push(point);
    }
  }
  /**
   * Notes on OPTICS clustering
   *
   * needs as input:
   *      core distance : minimum value of radius to classify point as core point, if no core point => core distance = undefined
   *      minPts : minimum number of points a core point should have
   *      List of points (db)
   *
   * needs helper functions
   * is_core_point
   * find_core_distance
   * find_reachability distance
   */

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
