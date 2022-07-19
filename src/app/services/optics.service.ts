import { Injectable } from '@angular/core';
import * as turf from "@turf/turf";

@Injectable({
  providedIn: 'root'
})
export class OpticsService {
  optics_points:Array<any> = []; 
  priorityQ: Array<any> = [];
  tmpColor:any = null;

  constructor() { }

  public clusterOptics(stayPoints, eps, minPts) {
    const orderedList = []; 
    this.priorityQ = [];

    const that = this;
    this.optics_points = stayPoints;
    for(let j = 0; j < this.optics_points.length; j++){
      const point = this.optics_points[j];
      // point.properties.reachability_distance = undefined; 
      if(!point.properties.processed){
        const neighbours = this.getNeighbours(point, eps);
        const clusterColor = this.getRandomColor();
        point.properties.color = clusterColor;
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
                queuedPoint.properties.color = clusterColor;
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
    const noNoise = orderedList.filter((point)=>
{      return point.properties.reachability_distance;
}    )
    console.log("w noise", orderedList)
    console.log("after",noNoise)

    return noNoise;


  }

  private updateOPTICS(neighbours, pt, eps, minPts){
    const coreDistance = this.getCoreDistance(pt, eps, minPts)
    const that = this; 
    for(let k = 0; k < neighbours.length; k++){
      let otherPoint = neighbours[k];
      if(!otherPoint.properties.processed) {
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

  /** HELPERS */

  private getRandomColor(){
    var color = '#' + Math.floor(Math.random() * 255).toString(16) + Math.floor(Math.random() * 255).toString(16) + Math.floor(Math.random() * 255).toString(16);
		if (color.length === 7 && this.tmpColor !== color) {

			this.tmpColor = color;
			return color;
		} else
			return this.getRandomColor();
  }

}
