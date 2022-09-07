import { Component, ElementRef, ViewChild } from "@angular/core";
import * as L from "leaflet";
import * as turf from "@turf/turf";
import { DatamanagerService } from "../services/datamanager.service";
import { OpticsService } from "../services/optics.service";
import { StaypointService } from "../services/staypoint.service";
import { DbmeansService } from "../services/dbmeans.service";
import { DbindexService } from "../services/dbindex.service";
import { SilhouetteService } from "../services/silhouette.service";
import { ToastController } from "@ionic/angular";
import { LoadingController } from "@ionic/angular";

@Component({
  selector: "app-tab1",
  templateUrl: "tab1.page.html",
  styleUrls: ["tab1.page.scss"],
})
export class Tab1Page {

  private map;

  stayPointDistance = 200;
  stayPointTime = 5;

  epsDBSCAN = 300;
  minPtsDBSCAN = 3;
  epsDBMeans = 300;
  minPtsDBMeans = 3;
  minPtsOPTICS = 3;

  stayPoints: any = [];
  opticsResult: any;
  dbscanResult: any;
  dbmeansResult: any;

  hoveredMarker: any;
  loadingScreen: any;
  tmpColor: any;

  data:any;
  layerControl: any;

  lastActivatedLayer:any;

  stayPointsDone:boolean = false;
  dataLoadingDone:boolean = false;
  stayPointsString:any;

  constructor(
    private dataManager: DatamanagerService,
    private opticsService: OpticsService,
    private staypointService: StaypointService,
    private dbMeansService: DbmeansService,
    private dbIndexService: DbindexService,
    private silhouetteService: SilhouetteService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private _elementRef : ElementRef
  ) {}

  ionViewDidEnter(): void {
    this.initMap();
  }

  initMap(): void {
    const tiles = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 18,
        minZoom: 3,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    );
    const baseMaps = { OSM: tiles };
    this.map = L.map("map", {
      center: [41.85, -87.65005],
      zoom: 9,
      layers: [tiles],
    });

    this.layerControl = L.control.layers(baseMaps).addTo(this.map);
    this.layerControl.expand();
  }

  clearMap() {
    this.map.eachLayer((layer) => {
      if (layer._url !== "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png") {
        layer.remove();
      }
    });
  }

  async loadDataSource(path) {
    const loadingScreen = await this.loadingController.create({
      message: `Loading data from ${path} `,
    });
    loadingScreen.present();
    switch (path) {
      case "geolife":
        this.data = await this.dataManager.getGeolifeTrajectories(
          "path153_2011.csv"
        );
        break;
      case "dmcl":
        this.data = await this.dataManager.getChicagoTrajectories();
        break;
      case "gsm":
        this.data = await this.dataManager.getGSMTrajectories();
        break;
      default:
        break;
    }

    this.map.setView(this.data[0].features[0].geometry.coordinates);
    // this.showSinglePointsOnMap();
    this.dataLoadingDone = true;
    loadingScreen.dismiss();
  }

  calculateStayPoints() {
    this.stayPoints = [];
    // get all trajectories in the specified path/filename

    // perform stay point extraction with the input values for time and dist threshold
    this.data.map((trajectory) => {
      const stayPoints = this.staypointService.extractStayPoints(
        trajectory.features,
        this.stayPointTime,
        this.stayPointDistance
      );
      if (stayPoints.length > 1) this.stayPoints.push(stayPoints);
    });
    // geojson for all points
    // clean array
    this.stayPoints = this.staypointService.cleanArray(this.stayPoints);

    let geojsonMarkerOptions = {
      radius: 8,
      fillColor: "#000",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    };

    this.stayPoints = turf.featureCollection(this.stayPoints);
    console.log("Stay points", this.stayPoints);
    const points = L.layerGroup();
    this.stayPoints.features.map((p) => {
      L.geoJSON(p, {
        pointToLayer: function (p, latlng) {
          const marker = L.circleMarker(latlng, geojsonMarkerOptions);
          marker.on("mouseover", function (ev) {
            this.hoverredMarker = p;
            marker.openTooltip();
          });
          marker.bindTooltip(
            `<b>Arrival time:</b> ${p.properties.arrivalTime.toISOString()} <br> <b>Leave time:</b> ${p.properties.leaveTime.toISOString()}`
          );
          return marker;
        },
      }).addTo(points);
    });
    this.layerControl.addOverlay(points, `Stay Points, distance:${this.stayPointDistance}; time:${this.stayPointTime}`);
    if(this.lastActivatedLayer) this.lastActivatedLayer.remove();
    this.lastActivatedLayer = points;
    this.map.addLayer(points);
    this.stayPointsDone = true;
    this.stayPointsString = JSON.stringify(this.stayPoints);
    this.showToastMessage("Stay point extraction done!", 1000, "top");


  }

  async getDBMeans() {
    const loadingScreen = await this.loadingController.create({
      message: `Executing DBMeans..`,
    });
    loadingScreen.present();
    const centroids: any = this.dbMeansService.clusterDBMeans(
      this.stayPoints.features,
      this.epsDBMeans,
      this.minPtsDBMeans
    );
    this.dbmeansResult = centroids;
    const clusterPoints = centroids.map((c) => c.points);
    this.showFeatureCollectionOnMap(this.dbmeansResult, `DBMeans, eps:${this.epsDBMeans}, minPts:${this.minPtsDBMeans}`);
    this.showToastMessage("DBMeans done!", 1000, "bottom");
    loadingScreen.dismiss();
  }

  async getDBSCAN() {
    const loadingScreen = await this.loadingController.create({
      message: `Executing DBSCAN..`,
    });
    loadingScreen.present();
    const cluster = turf.clustersDbscan(this.stayPoints, this.epsDBSCAN / 1000);
    const clusterResult = [];
    for (let index = 0; index < cluster.features.length; index++) {
      const element = cluster.features[index];
      const clusterId = element.properties.cluster;
      if (element.properties.dbscan !== "noise") {
        if (clusterResult[clusterId] === undefined) {
          // create new entry
          const cluster = { id: clusterId, points: [element], centroid: null };
          clusterResult.push(cluster);
        } else {
          clusterResult[clusterId].points.push(element);
        }
      }
    }
    for (let index = 0; index < clusterResult.length; index++) {
      const element = clusterResult[index];
      const tmp0 = turf.featureCollection(element.points);
      const centroid = turf.center(tmp0);
      element.centroid = centroid;
    }
    this.dbscanResult = clusterResult;
    loadingScreen.dismiss();

    this.showFeatureCollectionOnMap(clusterResult, `DBSCAN, eps:${this.epsDBSCAN}, minPts:${this.minPtsDBSCAN}`);
  }

  async getOPTICS() {
    const loadingScreen = await this.loadingController.create({
      message: `Executing OPTICS ... `,
    });
    loadingScreen.present();
    const opticsCluster = this.opticsService.clusterOptics(
      this.stayPoints.features,
      200,
      this.minPtsOPTICS
    );
    const clusterResult = [];
    let tmp = [];
    let idCounter = 1;
    for (let index = 0; index < opticsCluster.length; index++) {
      const element = opticsCluster[index];
      if (tmp.length < 1) {
        tmp.push(element);
      } else {
        const lastElement = opticsCluster[index - 1];
        if (
          element.properties.reachabilityDistance >
          lastElement.properties.reachabilityDistance
        ) {
          tmp.push(element);
        } else {
          clusterResult.push({ id: idCounter, points: tmp, centroid: null });
          tmp = [];
          idCounter++;
        }
      }
    }
    for (let index = 0; index < clusterResult.length; index++) {
      const element = clusterResult[index];
      const tmp0 = turf.featureCollection(element.points);
      const centroid = turf.center(tmp0);
      element.centroid = centroid;
    }
    this.opticsResult = clusterResult;
    this.showFeatureCollectionOnMap(this.opticsResult, "OPTICS");
    loadingScreen.dismiss();
    return;
  }

  showFeatureCollectionOnMap(data, name) {
    const layer = L.featureGroup();
    data.map((cluster) => {
      const geojsonMarkerOptions = {
        radius: 8,
        fillColor: this.getRandomColor(),
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      };
      cluster.points.map((point) => {
        L.geoJSON(point, {
          pointToLayer: function (p, latlng) {
            const marker = L.circleMarker(latlng, geojsonMarkerOptions);
            marker.on("mouseover", function (ev) {
              marker.openTooltip();
            });
            marker.bindTooltip(
              `<b>Cluster ID</b> ${cluster.id}<br> <b> Number of stay points: ${cluster.points.length}`
            );
            return marker;
          },
        }).addTo(layer);
      });
    });
    this.layerControl.addOverlay(layer, name);  
    if(this.lastActivatedLayer) this.lastActivatedLayer.remove();
    this.lastActivatedLayer = layer;
    this.map.addLayer(layer)

  }

  /**MISC */



  /** UI HELPER FUNCTIONS  */
  async showToastMessage(message, duration, position) {
    const toast = await this.toastController.create({
      message,
      duration,
      position,
    });
    await toast.present();
  }

  setStayPointTime(event) {
    const value = event.target.value;
    this.stayPointTime = value;
  }

  setStayPointDistance(event) {
    const value = event.target.value;
    this.stayPointDistance = value;
  }

  setEpsDBSCAN(event) {
    const value = event.target.value;
    this.epsDBSCAN = value;
  }
  setMinPtsDBSCAN(event) {
    const value = event.target.value;
    this.minPtsDBSCAN = value;
  }

  setEpsDBMeans(event) {
    const value = event.target.value;
    this.epsDBMeans = value;
  }
  setMinPtsDBMeans(event) {
    const value = event.target.value;
    this.minPtsDBMeans = value;
  }

  setMinPtsOPTICS(event) {
    const value = event.target.value;
    this.minPtsOPTICS = value;
  }

  private getRandomColor() {
    var color =
      "#" +
      Math.floor(Math.random() * 255).toString(16) +
      Math.floor(Math.random() * 255).toString(16) +
      Math.floor(Math.random() * 255).toString(16);
    if (color.length === 7 && this.tmpColor !== color) {
      this.tmpColor = color;
      return color;
    } else return this.getRandomColor();
  }

  calculateDbIndex(clusters) {
    this.dbIndexService.dbindex(clusters);
  }

  calculateSilhouette(clusters) {
    this.silhouetteService.calculateSilhouette(clusters);
  }
}
