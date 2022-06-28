import { Component, OnInit } from "@angular/core";
import * as L from "leaflet";
import { GeolifeService } from "../services/geolife.service";
import * as turf from "@turf/turf";
import { FeatureCollection } from "@turf/turf";
import * as xmljs from 'xml-js';

interface GeoLifeTrajectory {
  latslngs: [number, number][];
  dates: [string, string][];
}

@Component({
  selector: "app-tab1",
  templateUrl: "tab1.page.html",
  styleUrls: ["tab1.page.scss"],
})
export class Tab1Page implements OnInit {
  private map;
  file: any;
  fileContent: string;
  latslngs = [];
  trajectoryLayer: any;
  user: any;
  activeTrajectory: any;
  stayPoints: any = [];
  loading: boolean = false;
  distance1Threshold = 200;
  distance2Threshold = 300;
  timeThreshold = 15;
  clusterEnabled: boolean = false;
  clusterLayer: any;
  arrayPerCluster: any;
  countClusters;
  allPoints: any = [];
  frequencies:any;
  useFile:any = "";
  selectOptions = ["path.csv","path2weeks.csv","path004.csv","path026.csv","path142.csv","path147.csv","path153_2011.csv","path153.csv"]

  constructor(private geolifeService: GeolifeService) {}

  ionViewDidEnter(): void {
    this.initMap();
  }
  ngOnInit() {
    // this.user = await this.geolifeService.getAllTrajectories();
  }
  private initMap(): void {
    this.map = L.map("map", {
      center: [39.9, 116.4],
      zoom: 11,
    });

    const tiles = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        minZoom: 3,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    );

    tiles.addTo(this.map);
  }

  changeDist1Threshold(event) {
    const value = event.target.value;
    this.distance1Threshold = value;
  }

  changeDist2Threshold(event) {
    const value = event.target.value;
    this.distance2Threshold = value;
  }

  changeTimeThreshold(event) {
    const value = event.target.value;
    this.timeThreshold = value;
  }

  changePath(event){
    console.log(event.target.value);
    const value = event.target.value;
    this.useFile = value;
  }

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
    map_arr.map((frequency)=>{
      this.arrayPerCluster[frequency.id].frequency = frequency;
    })
  }

  clusterOptics(){
    this.geolifeService.clusterOptics(this.stayPoints,this.distance2Threshold,3);
    
  }

  // triggers service function which provides all stay points in all given trajectories
  // sets stay points and cleans them for further use in clustering
  async calculateStayPoints() {
    this.loading = true;
    this.stayPoints = [];
    // get all trajectories in the specified path/filename
    this.user = await this.geolifeService.getAllTrajectories(this.useFile);
    const stayPointLayer = L.featureGroup();

    // perform stay point extraction with the input values for time and dist threshold
    this.user.filteredT.map((trajectory) => {
      const stayPoints = this.geolifeService.extractStayPoints(
        trajectory,
        this.timeThreshold,
        this.distance1Threshold
      );
      if (stayPoints.length > 1) this.stayPoints.push(stayPoints);
      // add calculated points to the leaflet map
      stayPoints.map((point) => {
        //const marker =   L.marker([point.meanLatitude,point.meanLongitude]).addTo(this.map);
        L.circle([point.meanLatitude, point.meanLongitude], {
          radius: 100,
          color: "black",
        }).addTo(stayPointLayer);
        //create geooJSONs for all points
        trajectory.map((point) => {
          const turfPoint = turf.point([point.lng, point.lat], {
            date: point.date,
          });
          this.allPoints.push(turfPoint);
        });
      });
    });

    stayPointLayer.addTo(this.map);
    // geojson for all points
    this.allPoints = turf.featureCollection(this.allPoints);
    this.loading = false;

    // clean array
    this.stayPoints = this.geolifeService.cleanArray(this.stayPoints);
  }

  countingClusters() {
    const knownClusters = [];
    this.clusterLayer.features.map((feature) => {
      if (feature.properties.dbscan != "noise") {
        if (!knownClusters.includes(feature.properties.cluster))
          knownClusters.push(feature.properties.cluster);
      }
    });
    this.countClusters = knownClusters.length;
  }

  // arrange clusters in {id:0, pointsWithin:[<Points]} object array for further usage
  filterClusters() {
    const arrayPerCluster: any = [];
    for (let i = 0; i < this.countClusters; i++) {
      arrayPerCluster.push({
        clusterId: i,
        stayPoints: [],
      });
    }
    this.clusterLayer.features.map((feature) => {
      arrayPerCluster.map((cluster) => {
        if (feature.properties.dbscan === "noise") {
        }
        if (feature.properties.cluster === cluster.clusterId) {
          cluster.stayPoints.push(feature);
        }
      });
    });

    arrayPerCluster.map((cluster) => {
      const points = turf.featureCollection([...cluster.stayPoints]);
      const hull = turf.convex(points);
      const bbox = turf.bbox(hull)
      hull.properties.bbox = bbox;    
      let style = {
        color: cluster.stayPoints[0].properties.color,
      };
      L.geoJSON(hull, { style }).addTo(this.map);
      cluster.pointsWithin = turf.pointsWithinPolygon(this.allPoints, hull);
      cluster.hull = hull;
      let centroid = turf.centroid(cluster.hull);
      cluster.centroid = centroid;

    });

    this.arrayPerCluster = arrayPerCluster;
    this.triggerOSMInfo();
    //this.applyPPMModel();

    this.arrayPerCluster.map(cluster=>{
      const marker = L.marker(cluster.centroid.geometry.coordinates.reverse()).addTo(this.map);
      const popup = L.popup()
      // .setLatLng(cluster.hull.geometry.coordinates[0][0].reverse())
      .setContent(`clusterId:${cluster.clusterId}<br> Total points in cluster:${cluster.pointsWithin.features.length}<br>Stay points:${cluster.stayPoints.length}<br>`)
      marker.bindPopup(popup);

    })


  }
  

  async triggerOSMInfo(){
    this.arrayPerCluster.map(async(cluster)=>{
      const xml = await this.geolifeService.getOSMInfo(cluster.hull.properties.bbox);
      // parse xml as json 
      let json:any= xmljs.xml2json(xml,{compact:true,spaces:4})
      json = JSON.parse(json);
      // remove all objects with no tags 
      json =  json.osm.node.filter(node=>node.tag)
      cluster.hull.properties.osmInfo = json;
    })
    console.log(this.arrayPerCluster)
  }

  // triggers service function to calculate a DBSCAN on the trajectories
  calculateClusters() {
    const clustered = this.geolifeService.clusterStaypoints(
      this.stayPoints,
      this.distance2Threshold / 1000,
      {}
    );
    this.clearMap();
    this.clusterLayer = clustered;

    this.countingClusters();

    const clusterLayer = L.featureGroup();
    clustered.features.map((feature) => {
      let color;
      // find a more "dynamic" way for coloring
      switch (feature.properties.cluster) {
        case 0:
          color = "crimson";
          break;
        case 1:
          color = "blue";
          break;
        case 2:
          color = "green";
          break;
        case 3:
          color = "purple";
          break;
        case 4:
          color = "cyan";
          break;
        case 5:
          color = "magenta";
          break;
        case 6:
          color = "lime";
          break;
        case 7:
          color = "brown";
          break;
        case 8:
          color = "orange";
          break;
        case 9:
          color = "yellow";
          break;
        case 10:
          color = "indigo";
          break;
        case 11:
          color = "navy";
          break;
        case 12:
          color = "maroon";
          break;
        case 13:
          color = "saddlebrown";
          break;
        case 14:
          color = "teal";
          break;
        case 15:
          color = "sienna";
          break;
        case 16:
          color = "plum";
          break;
        default:
          color = "black";
          break;
      }
      feature.properties.color = color;
      L.circle(
        [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
        { radius: 10, color: color }
      ).addTo(clusterLayer);
    });
    this.stayPoints = this.geolifeService.convertStaypointsToGEOJSON(
      this.stayPoints
    );
    clusterLayer.addTo(this.map);
    this.filterClusters();

    //this.map.fitBounds(clusterLayer.getBounds())
  }

  // trajectories wont be loaded onto a map now
  loadToMap(trajectory) {
    const trajectoryLayer = L.layerGroup();
    this.activeTrajectory = trajectory;
    trajectory.map((point, index) => {
      let color;
      switch (index) {
        case 0:
          color = "#00c853"; // green
          break;
        case trajectory.length - 1:
          color = "#d50000"; // red
          break;
        default:
          color = "#6200ea";
          break;
      }
      L.circle([point.lat, point.lng], { radius: 15, color }).addTo(
        trajectoryLayer
      );
    });
    // const polyline = L.polyline(trajectory.latslngs, { color: 'blue' }).addTo(trajectoryLayer)
    trajectoryLayer.addTo(this.map);
    // this.map.fitBounds(polyline.getBounds())
  }

  clearMap() {
    this.map.eachLayer((layer) => {
      if (layer._url !== "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png") {
        layer.remove();
      }
    });
  }
}
