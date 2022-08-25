import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";

@Injectable({
  providedIn: 'root'
})
export class SilhouetteService {

  constructor() { }

  public calculateSilhouette(clusters){
    let sumSValues = 0;

    for (let index = 0; index < clusters.length; index++) {
      const element = clusters[index];
      const cohesion = this.calculateCohesion(element);
      const seperation = this.calculateSeperation(element, clusters);
      const normalizing = Math.max(cohesion, seperation)
      const s = (seperation - cohesion) / normalizing; 
      sumSValues += s;
    }

    const s = (1/clusters.length) * sumSValues; 
    console.log(s); 
    return s
  }

  private calculateCohesion(cluster){
    let sumDistances = 0;
    const element = cluster.points[0];
    for (let index = 0; index < cluster.points.length-1; index++) {
      const distanceToOtherPoint = turf.distance(element, cluster.points[index+1], {units:"meters"});
      sumDistances += distanceToOtherPoint;

    } 
    const cohesion = (1/cluster.points.length-1) * sumDistances; 
    console.log(cohesion, sumDistances)
    return cohesion;
  }

  private calculateSeperation(cluster1, clusters){
    let sumDistances = [];
    // for every cluster
    for (let index = 0; index < clusters.length; index++) {
      const element = clusters[index];
      if(element.id === cluster1.id) continue; 
      else {
        const avgDistances = this.calculateAvgDistanceToOtherCluster(cluster1, element);
        sumDistances.push(avgDistances);
      }
    }

    const minValue = this.findMinimumValueInArray(sumDistances);
    const seperation = (1/cluster1.points.length) * minValue;
    return seperation

  }

  private calculateAvgDistanceToOtherCluster(cluster1, cluster2){
    let sumDistance = 0;
    for (let index = 0; index < cluster2.points.length; index++) {
      const element = cluster2.points[index];
      const distance = turf.distance(cluster1.points[0], element, {units:"meters"});
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
