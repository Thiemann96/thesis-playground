import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet'
import { GeolifeService } from '../services/geolife.service';

interface GeoLifeTrajectory {
  latslngs: [number, number][]
  dates: [string, string][]
}


@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss']
})
export class Tab1Page implements OnInit{
  private map;
  file: any
  fileContent: string
  latslngs = []
  trajectoryLayer: any
  user:any  
  activeTrajectory:any;
  constructor(
    private geolifeService: GeolifeService
  ) {}

  ionViewDidEnter(): void {
    this.initMap();
    
  }
  async ngOnInit(){
    this.user = await this.geolifeService.getAllTrajectories();
    console.log("finished loading",this.user);
  }
  private initMap(): void {
    this.map = L.map('map', {
      center: [39.9, 116.4],
      zoom: 10,
    })

    const tiles = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 18,
        minZoom: 3,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    )

    tiles.addTo(this.map)
  }

  calculateStayPoints(){
   const stayPoints =  this.geolifeService.extractStayPoints(this.activeTrajectory);

   stayPoints.map((point)=>{
     L.circle([point.meanLatitude, point.meanLongitude],{ radius: 20, color:'purple'}).addTo(this.map)
   })
  }

  loadToMap(trajectory) {
    const trajectoryLayer = L.layerGroup()
    this.activeTrajectory = trajectory;
    trajectory.map((point, index) => {
      let color
      switch (index) {
        case 0:
          color = '#00c853' // green
          break
        case trajectory.length - 1:
          color = '#d50000' // red
          break
        default:
          color = '#6200ea'
          break
      }
      L.circle([point.lat,point.lng], { radius: 15, color }).addTo(trajectoryLayer)
    })
   // const polyline = L.polyline(trajectory.latslngs, { color: 'blue' }).addTo(trajectoryLayer)
    trajectoryLayer.addTo(this.map)
   // this.map.fitBounds(polyline.getBounds())
  }

  clearMap() {
    this.map.eachLayer((layer) => {
      if (layer._url !== 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png') {
        layer.remove()
      }
    })
  }

}
