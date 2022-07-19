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
    console.log(eps,minPts)
    const that = this;
    this.optics_points = stayPoints;
    for(let j = 0; j < this.optics_points.length; j++){
      const point = this.optics_points[j];
      // point.properties.reachability_distance = undefined; 
      if(point.properties.processed !== true){
        point.properties.processed = true; 
        const neighbours = this.getNeighbours(point, eps);
        const clusterColor = this.getRandomColor();
        orderedList.push(point);
        const coreDistance = this.getCoreDistance(point, eps, minPts);
        if(coreDistance !== undefined){
            this.priorityQ = [];
            this.updateOPTICS(neighbours, point, eps, minPts)
            for(let i = 0; i < this.priorityQ.length; i++){
              const queuedPoint = this.priorityQ[i]
              if(!this.priorityQ[i].properties.processed){
                const neighbours_alt = that.getNeighbours(queuedPoint, eps);
                this.priorityQ[i].properties.processed = true;
                orderedList.push(this.priorityQ[i]);
                const coreDistanceAlt = that.getCoreDistance(this.priorityQ[i], eps, minPts);
                if(coreDistanceAlt !== undefined){
                  that.updateOPTICS(neighbours_alt, this.priorityQ[i], eps, minPts);
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
    
    noNoise.map(p=>{
      if(!p.properties.des){
        p.properties.des = true;
        const neigh = this.getNeighbours(p,eps);

      }
      
    })


    return noNoise;


  }

  private updateOPTICS(neighbours, pt, eps, minPts){
    const coreDistance = this.getCoreDistance(pt, eps, minPts)
    const that = this; 
    for(let k = 0; k < neighbours.length; k++){
      let otherPoint = neighbours[k];
      if(otherPoint.properties.processed !== undefined)
      {
        const new_distance = turf.distance(pt.geometry.coordinates, otherPoint.geometry.coordinates,{units:"meters"})
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
      if(pt !== point){
        const distance = turf.distance(pt.geometry.coordinates, point.geometry.coordinates, {units:"meters"});
        if (distance < eps) return point;
      }

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
    console.log("before",this.priorityQ)
    for(let i = 0; i < this.priorityQ.length;i++){
      if(this.priorityQ[i] === point){
        const firstQPart = this.priorityQ.slice(0,i);
        const secondQPart = this.priorityQ.slice(i+1, this.priorityQ.length);
        this.priorityQ = firstQPart.concat(secondQPart);
        break;
      }
    }
  console.log("after",this.priorityQ)

  }
  
  // according to here https://www.geeksforgeeks.org/implementation-priority-queue-javascript/
  private insertQElement(point){
    let indexToInsert = this.priorityQ.length; 

    for(let i = this.priorityQ.length - 1; i >= 0; i--){
      if(this.priorityQ[i].properties.reachability_distance > point.properties.reachability_distance){
        indexToInsert = i; 
      }
      }
      this.insertAt(point, indexToInsert)
    }

    private insertAt(point, index){
      if(this.priorityQ.length === index){
        this.priorityQ.push(point);
      }
      else {
        let currentElement = this.priorityQ[index];
        if(this.priorityQ[index] === undefined){ return false;}
        this.priorityQ[index] = point
        let length = this.priorityQ.length + 1; 
        for(let pos = index + 1; pos < length; pos++){
          let lastElement = this.priorityQ[pos];
          this.priorityQ[pos] = currentElement; 
          currentElement = lastElement
        }
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
