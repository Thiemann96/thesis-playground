import { Component, OnInit } from "@angular/core";
import * as L from "leaflet";
import { GeolifeService } from "../services/geolife.service";

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
  distance1Threshold = 100; 
  distance2Threshold = 100; 
  timeThreshold = 15;
  clusterEnabled:boolean = false;
  clusterLayer:any;
  countClusters; 

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

  changeDist1Threshold(event){
    const value = event.target.value; 
    this.distance1Threshold = value; 
  }

  changeDist2Threshold(event){
    const value = event.target.value; 
    this.distance2Threshold = value; 
  }

  changeTimeThreshold(event){
    const value = event.target.value; 
    this.timeThreshold = value; 
  }

  

  async calculateStayPoints() {
    this.loading = true;
    this.stayPoints = [];
    this.user = await this.geolifeService.getAllTrajectories();
    const stayPointLayer = L.featureGroup();

    this.user.filteredT.map((trajectory) => {
      const stayPoints = this.geolifeService.extractStayPoints(trajectory, this.timeThreshold, this.distance1Threshold);
      if (stayPoints.length > 1) this.stayPoints.push(stayPoints);
      stayPoints.map((point) => {
        //const marker =   L.marker([point.meanLatitude,point.meanLongitude]).addTo(this.map);
        L.circle([point.meanLatitude, point.meanLongitude], {
          radius: 100,
          color: "black",
        }).addTo(stayPointLayer);
        // marker.bindPopup(point.arrivalTime+"-"+point.leaveTime).openPopup();
      });
    });
    stayPointLayer.addTo(this.map);
    //this.map.fitBounds(stayPointLayer.getBounds())
    this.loading = false;
    this.clusterEnabled = true;
    this.stayPoints = this.geolifeService.cleanArray(this.stayPoints)
  }

  countingClusters () {
    const knownClusters = [];
    this.clusterLayer.features.map(feature=>{
      if(feature.properties.dbscan != "noise"){
        if(!knownClusters.includes(feature.properties.cluster)) knownClusters.push(feature.properties.cluster)
      }
    })
    this.countClusters = knownClusters.length;
  }


  calculateClusters() {
    const clustered = this.geolifeService.clusterStaypoints(
      this.stayPoints,
      this.distance2Threshold/1000,
      {}
    );

    this.clearMap();
    console.log(clustered);
    this.clusterLayer = clustered;

    this.countingClusters();

    const clusterLayer = L.featureGroup();
    clustered.features.map((feature) => {
        let color;
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
        L.circle(
          [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
          { radius: 100, color: color }
        ).addTo(clusterLayer);
      
    });
    clusterLayer.addTo(this.map);
    //this.map.fitBounds(clusterLayer.getBounds())
  }

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
