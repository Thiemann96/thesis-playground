import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";

@Injectable({
  providedIn: 'root'
})
export class DbmeansService {

  constructor() { }


  /**
   * 
   * @param staypoints a set of points 
   * @param eps the raidus of the cluster > 0 
   * @param minPts minimum size of the cluster > 0
   */
  public clusterDBMeans(staypoints, eps, minPts){
    const centroids = []; 
    let classId = 1;
    // label every point is unvisited
    staypoints.map(p=> p.properties.label = 'unvisited');
    while(this.unvisitedInData(staypoints)){
      let c =  staypoints[this.getRndInteger(0,staypoints.length)];
      let m:any = {c};  // memory
      let m_bak = {}; // short term memory
      c.properties.label = 'noise';
      while(m !== m_bak){
        m_bak = m;  
        m = {};
        let c_m:any = []; // set of objects which belong to the same cluster
        // über jeden staypunkt iterieren und distanz zu ausgangspunkt prüfen
        for (let index = 0; index < staypoints.length; index++) {
          const element = staypoints[index];
          const distance = turf.distance(c, element);
          if(distance < eps) {
            m = {...m, element};
            // wenn distanz unter schwellwert und punkt noch nicht besucht und kein noise dann füge zu cluster hinzu
            if(element.properties.label !== 'unvisited' || element.properties.label !== 'noise'){
              c_m.push(element.properties.label);
            }
          }        
        }
        // berechne neues centroid für das cluster
        c = this.calculateMean(m);
        let pushed = false;
        // für jedes cluster in c_m
        for (let index = 0; index < c_m.length; index++) {
          const element = c_m[index];
          if(c_m.length > minPts){
            element.properties.label = 'noise';
            if(!pushed) centroids.push(turf.center(c_m))
            pushed = true;  
          }
        }
      }
      m.map(p=>p.properties.label = classId)
      classId++;
      centroids.push({classId,c});
    }
    // c = predict(P, centroids,eps)
    // return c;
  }
/**
 * 
 * @param p Set of points
 * @param centroids centroids calculated before
 * @param eps minimum radius
 */
  private predictC(p, centroids, eps){

  }

  private calculateMean(menge){
    let sum_lat = 0;
    let sum_lng = 0;
    let count = 0; 
    const mean = menge.map(p=>{
      sum_lng +=  p.geometry.coordinates[0]
      sum_lat +=  p.geometry.coordinates[1] 
      count++;
    })
    const avg_lat = sum_lat / count;
    const avg_lng = sum_lng / count

    return [avg_lng, avg_lat]; 
  }
  /** 
   * 
   * @param points set of points
   * @returns 
   */
  private unvisitedInData(points){
    for (let index = 0; index < points.length; index++) {
      const element = points[index];
      if(element.properties.label === 'unvisited') return true;
      else return false;
      
    }
  }
/**
 * 
 * @param c point to look for 
 * @param p set of points
 * @param eps minimum distance
 */
  private getNeighbours(c, p, eps){
   const neighbours = []
    for (let index = 0; index < p.length; index++) {
      const element = p[index];
      const distance = turf.distance(c, element, {units:'meters'})
      if(distance < eps) neighbours.push(element);
    }  
    return neighbours;
  }
  // https://www.w3schools.com/JS/js_random.asp
  private getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
  }
}
