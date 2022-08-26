import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";

@Injectable({
  providedIn: 'root'
})
export class SilhouetteService {

  constructor() { }

  public calculateSilhouette(clusters){
    let sumSValues = 0;

    for (let index = 0; index < clusters.length-1; index++) {
      const element = clusters[index];
      const cohesion = this.calculateCohesion(element);
      const seperation = this.calculateAvgDistanceToOtherCluster(element.points[0], clusters[index+1]);
      const normalizing = Math.max(cohesion, seperation)
      const s = (seperation - cohesion) / normalizing; 
      sumSValues += s;
    }

    const s = (1/clusters.length) * sumSValues; 
    console.log(s); 
    return s
  }


  // calculate mean distance from one point in the cluster to all other points in the cluster
  private calculateCohesion(cluster){
    let sumDistances = 0;
    const element = cluster.points[0];
    for (let index = 0; index < cluster.points.length; index++) {
      if(index === 0 ) continue;
      const distanceToOtherPoint = turf.distance(element, cluster.points[index], {units:"meters"});
      sumDistances += distanceToOtherPoint;

    } 
    // average with all points
    const cohesion = (1/(cluster.points.length-1)) * sumDistances; 
    return cohesion;
  }

  // mean distance from one point to the neighbouring cluster
  // neighbouring cluster is found by calculating all values and selecting the minimal one 
  

  private calculateAvgDistanceToOtherCluster(point, cluster2){
    let sumDistance = 0;
    for (let index = 0; index < cluster2.points.length; index++) {
      const element2 = cluster2.points[index];
      const distance = turf.distance(point, element2, {units:"meters"});
      sumDistance += distance;
    }
    return (sumDistance / cluster2.points.length); 
  }


  private findMinimumValueInArray(array){
    let minValue; 
    for (let index = 0; index < array.length; index++) {
      const element = array[index];
      if(minValue === undefined){
        minValue = element;
      }
      else {
        if (element < minValue){
          minValue = element;
        }
      }
    }
    return minValue;
  }


}
