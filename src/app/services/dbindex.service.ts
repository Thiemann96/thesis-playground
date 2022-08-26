import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";


@Injectable({
  providedIn: 'root'
})
export class DbindexService {

  constructor() { }


  /**
   * DB Index 
   *  average of 
   */

  public dbindex(clusters){ 
    const maxedRValues = [];
  
    for (let i = 0; i < clusters.length; i++) {
      const element = clusters[i];
      const r_values = [];
      for (let j = 0; j < clusters.length; j++) {
        if( i === j ) continue;
        const element2 = clusters[j];
        const r = this.calculateR(element,element2);
        const r2 = this.calculateR(element2, element);
        r_values.push(r);
      }
      const tmp = this.findMaxValueInArray(r_values);
      maxedRValues.push(tmp);
    } 
    const sumR = this.sumValuesInArray(maxedRValues);
    const db = (1/clusters.length) * sumR;
    console.log(db);
    return db; 
  }



  private calculateR(cluster1, cluster2){
    const s1 = this.calculateAvgDistanceToCentroid(cluster1);
    const s2 = this.calculateAvgDistanceToCentroid(cluster2);
    const m12 = turf.distance(cluster1.centroid, cluster2.centroid, {units:"meters"})
    const r = (s1+s2)/m12;
    return r;
  }

  /**
   * 
   * @param cluster 
   */
  private calculateAvgDistanceToCentroid(cluster){
    let sumDistance = 0; 
    for (let index = 0; index < cluster.points.length; index++) {
      const element = cluster.points[index];
      const distanceToCentroid = turf.distance(element,cluster.centroid,{units:"meters"});
      sumDistance += distanceToCentroid
    }

    const avgDistance = sumDistance / cluster.points.length;
    return avgDistance;
  }



  /** HELPERS */
  private findMaxValueInArray(array){
    let maxValue; 
    for (let index = 0; index < array.length; index++) {
      const element = array[index];
      if(maxValue === undefined){
        maxValue = element;
      }
      else {
        if (element > maxValue){
          maxValue = element 
        }
      }
      
    }
    return maxValue;
  }

  private sumValuesInArray(array){
    let sumValue = 0; 
    for (let index = 0; index < array.length; index++) {
      const element = array[index];
      sumValue += element;
    }
    return sumValue;
    
  }



}
