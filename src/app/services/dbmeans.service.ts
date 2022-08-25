import { Injectable } from "@angular/core";
import * as turf from "@turf/turf";

@Injectable({
  providedIn: "root",
})
export class DbmeansService {
  constructor() {}

  /**
   *
   * @param staypoints a set of points
   * @param eps the raidus of the cluster > 0
   * @param minPts minimum size of the cluster > 0
   */
  public clusterDBMeans(staypoints, eps, minPts) {
    const centroids = [];
    const tempArray = [];
    let classId = 1;
    // label every point is unvisited
    staypoints.map((p) => (p.properties.label = "unvisited"));
    // while there is an unvisited point do ... :
    while (this.unvisitedInData(staypoints)) {
      // get random point from list of staypoints; result may be different every time
      let c = staypoints[this.getRndInteger(0, staypoints.length - 1)];
      let m: any = [c]; // memory
      let m_bak = []; // short term memory
      c.properties.label = "noise";
      // do as long as neighbourdhood is changing
      while (m.length !== m_bak.length) {
        m_bak = m;
        m = [];
        let c_m: any = []; // set of objects which belong to the same cluster
        // über jeden staypunkt iterieren und distanz zu ausgangspunkt prüfen
        for (let index = 0; index < staypoints.length; index++) {
          const element = staypoints[index];
          const distance = turf.distance(c, element, { units: "meters" });
          // if within neighbourhood add to memory(!)
          if (distance < eps) {
            m = [...m, element];
            // when also not visited and not noise then push to cluster
            if (
              element.properties.label == "unvisited" ||
              element.properties.label !== "noise"
            ) {
              c_m.push(element);
            }
          }
        }
        if (c_m.length > 1) {
          c = turf.featureCollection(c_m);
          c = turf.center(c);
        }
        // re-calucalte mean centroid of cluster

        // für jedes cluster in c_m
        if (c_m.length > minPts) {
          centroids.push(c);
          classId++;
        }
        c_m.forEach((point) => {
          if (c_m.length > minPts) {
            point.properties.label = "noise";
          }
        });
      }
    }

    const clusters = this.predictC(staypoints, centroids, eps);
    return clusters;

    // return c;
  }
  /**
   * The predict function mentioned in the
  pseudo-code looks for the minimum distance from the
  points P to their given centroids taking into considera-
  tion the radius defined by Eps similar to a KMeans
  approach.


  after all centroids have been found out, iterate over the whole list of points and centroid
  find for each centroid the minimum distance and apply the one with the least distance to be in that centroid cluster 
 * @param p Set of points
 * @param centroids centroids calculated before
 * @param eps minimum radius
 */
  private predictC(p, centroids, eps) {
    // for each point
    const clusters = [];
    for (let index = 0; index < centroids.length; index++) {
      const element = centroids[index];
      clusters.push({ id: index, centroid: element, points: [] });
    }
    for (let i = 0; i < p.length; i++) {
      const point = p[i];
      let minDistance;
      // for each centroid
      for (let j = 0; j < centroids.length; j++) {
        const center = centroids[j];
        const distance = turf.distance(point, center, { units: "meters" });
        if (distance < eps) {
          if (!minDistance) minDistance = { j, distance };
          else if (distance < minDistance.distance) {
            minDistance = { j, distance };
          }
          let select;
          for (let index = 0; index < clusters.length; index++) {
            const element = clusters[index];
            if (element.id === minDistance.j) {
              select = element;
            }
          }
          select.points.push(point);
        }
      }
    }
    return clusters;
  }

  private findMinimum(array) {
    let min;
    let id;
    for (let index = 0; index < array.length; index++) {
      const element = array[index];
      if (element < min) {
        min = element;
      }
    }
    return { min, id };
  }

  private calculateMean(menge) {
    let sum_lat = 0;
    let sum_lng = 0;
    let count = 0;
    const mean = menge.map((p) => {
      sum_lng += p.geometry.coordinates[0];
      sum_lat += p.geometry.coordinates[1];
      count++;
    });
    const avg_lat = sum_lat / count;
    const avg_lng = sum_lng / count;

    return turf.point([avg_lng, avg_lat]);
  }
  /**
   *
   * @param points set of points
   * @returns
   */
  private unvisitedInData(points) {
    for (let index = 0; index < points.length; index++) {
      const element = points[index];
      if (element.properties.label === "unvisited") return true;
    }
    return false;
  }
  /**
   *
   * @param c point to look for
   * @param p set of points
   * @param eps minimum distance
   */
  private getNeighbours(c, p, eps) {
    const neighbours = [];
    for (let index = 0; index < p.length; index++) {
      const element = p[index];
      const distance = turf.distance(c, element, { units: "meters" });
      if (distance < eps) neighbours.push(element);
    }
    return neighbours;
  }
  // https://www.w3schools.com/JS/js_random.asp
  private getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
