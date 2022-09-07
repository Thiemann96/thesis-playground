import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PpmmodelService {
  arrayPerCluster:any;
  allPoints:any;
  
  constructor() { }


    /**Throwaway from PPM Model
   *
   */
     transformToBinary() {
      const finalBinarySequence = [];
      const sectionArray = this.divideIntoSections();
      const hullClusterThree = this.arrayPerCluster[0].hull;
      for (let n = 0; n < this.arrayPerCluster.length; n++) {
        const ptsWithin = this.arrayPerCluster[n].pointsWithin.features;
        const binarySequence = [];
        for (let i = 0; i < sectionArray.length; i++) {
          const section = sectionArray[i];
          for (let j = 0; j < section.length; j++) {
            const point = section[j];
            if (ptsWithin.includes(point)) {
              binarySequence.push(1);
              break;
            }
          }
          binarySequence.push(0);
        }
        finalBinarySequence.push(binarySequence);
      }
      return finalBinarySequence;
    }
  
    divideIntoSections() {
      // 1800000ms are 30 mins
      let sectionArray = [];
      let arrayToAdd = [];
      let snap = false;
      for (let i = 0; i < this.allPoints.features.length; i++) {
        const element = this.allPoints.features[i];
        if (i === 0) {
          arrayToAdd.push(element);
        }
        const time = element.properties.date;
        const timePassedSinceStart = time - arrayToAdd[0].properties.date;
        if (timePassedSinceStart > 1800000) {
          sectionArray.push(arrayToAdd);
          arrayToAdd = [element];
        } else {
          arrayToAdd.push(element);
        }
      }
      return sectionArray;
    }
  
    applyPPMModel() {
      // gets as input X binary sequence and T time threshold max
      const binarySequence = this.transformToBinary();
      const t_max = 722;
  
      const map_arr = [];
      for (let n = 0; n < binarySequence.length; n++) {
        let max_period = { id: -1, T: 0, P: 0 };
        let t = 1;
        while (t < t_max) {
          let probability = 0;
          const sequence = binarySequence[n];
          for (let i = 0; i < t - 1; i++) {
            const p_i = sequence[i];
            const q_i = 1 - p_i;
            let nominator_p = 0;
            let nominator_q = 0;
            for (let k = 0; k < t - 1; k++) {
              nominator_p += Math.pow(sequence[k], t);
              nominator_q += Math.pow(1 - sequence[k], t);
            }
            let c = p_i / nominator_p - q_i / nominator_q;
            if (c < 0) c === 0;
            probability += c;
          }
          t += 1;
          if (probability > max_period.P)
            max_period = { id: n, T: t, P: probability };
        }
        map_arr.push(max_period);
      }
      map_arr.map((frequency) => {
        this.arrayPerCluster[frequency.id].frequency = frequency;
      });
    }
}
