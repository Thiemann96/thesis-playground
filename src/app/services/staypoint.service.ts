import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";

@Injectable({
  providedIn: 'root'
})
export class StaypointService {

  constructor() { }

  public extractStayPoints(trajectory, timeThreshold, distThreshold) {
    const stayPoints = [];
    let i = 0;
    while (i < trajectory.length) {
      let j = i + 1;
      while (j < trajectory.length) {
        const distance = turf.distance(trajectory[j], trajectory[i], { units: "meters" });
        if (distance > distThreshold) {
          const deltaTime = (trajectory[j].properties.date - trajectory[i].properties.date) / 60000; // convert to minutes
          if (deltaTime > timeThreshold) {
            const center = this.computeMeanCoordinate(
              trajectory[j].geometry.coordinates[1],
              trajectory[j].geometry.coordinates[0],
              trajectory[i].geometry.coordinates[1],
              trajectory[i].geometry.coordinates[0]
            );
            const sp = turf.point([center[0],center[1]],{
              arrivalTime:trajectory[i].properties.date,
              leaveTime: trajectory[j].properties.date
            });
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

  /**
   * HELPERS
   */

   public cleanArray(stayPoints) {
    const pointArray = [];
    stayPoints.map((point) => {
      point.map((realPoint) => {
        pointArray.push(realPoint);
      });
    });
    return pointArray;
  }

   private computeMeanCoordinate(latA, lngA, latB, lngB): Array<number> {
    const lats = latA + latB;
    const lons = lngA + lngB;

    const meanCoords = [lats / 2, lons / 2];
    return meanCoords;
  }

}
