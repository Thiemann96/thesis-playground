import { Component, OnInit } from "@angular/core";
import * as L from "leaflet";
import { GeolifeService } from "../services/geolife.service";
import * as turf from "@turf/turf";
import { FeatureCollection } from "@turf/turf";
import * as xmljs from "xml-js";
import { DatamanagerService } from "../services/datamanager.service";
import { OpticsService } from "../services/optics.service";
import { StaypointService } from "../services/staypoint.service";
import { OsmService } from "../services/osm.service";
import { DbmeansService } from "../services/dbmeans.service";
import { DbindexService } from "../services/dbindex.service";
import { SilhouetteService } from "../services/silhouette.service";

interface GeoLifeTrajectory {
  latslngs: [number, number][];
  dates: [string, string][];
}


/**
 * filter noise 
 * stay points
 * clustering 
 * query cluster centroid for category 
 *  possible categories: food/dining acitivities, entertainment activites, healthcare, misc. 
 *  query for nwr, select the closest 
 * categorize stay points to the cluster they are in 
 * 
 */


/** Todo: 
 * rework db index / verify db index 
 * think about classifying 
 */

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
  layerControl:any; 
  frequencies: any;
  useFile: any = "";
  dbmeansResult:any;
  opticsResult:any;
  dbscanResult:any;
  chicago: any; 
  gsmData:any;
  selectOptions = [
    "path.csv",
    "path2weeks.csv",
    "path004.csv",
    "path026.csv",
    "path142.csv",
    "path153_2011.csv",
  ];

  constructor(
    private dataManager: DatamanagerService,
    private opticsService: OpticsService,
    private staypointService: StaypointService,
    private osmService: OsmService,
    private dbMeansService: DbmeansService,
    private dbIndexService: DbindexService,
    private silhouetteService: SilhouetteService
  ) {}

  ionViewDidEnter(): void {
    this.initMap();
    // load file and perform all clustering on it 
    //this.loadFile("path004.csv");
    this.loadFile("path142.csv");
    //this.dataManager.getChicagoTrajectories();


  }
  ngOnInit() {
    // this.user = await this.geolifeService.getAllTrajectories();
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
    const baseMaps = { "OSM": tiles }
    this.map = L.map("map", {
      center: [39.9, 116.4],
      zoom: 11,
      layers : [tiles]
    });
    this.layerControl = L.control.layers(baseMaps).addTo(this.map);

  }

  /**CLUSTERING ALGORIHTMS
   * should output every cluster like this:
   * {id: <cluster_id>, points: Array<Point>, centroid: Point}
   * 
   * 
  */


  clusterOptics() {
    const opticsCluster = this.opticsService.clusterOptics(
      this.stayPoints.features,
      this.distance2Threshold,
      2
    );
    this.clearMap();
    const opticsLayer = L.featureGroup();
    opticsCluster.map((point) => {
      var geojsonMarkerOptions = {
        radius: 8,
        fillColor: "#fff",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      };

      L.geoJSON(point, {
        pointToLayer: function (feature, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },
      }).addTo(opticsLayer);
    });
    this.layerControl.addOverlay(opticsLayer, "OPTICS");

    const clusterResult = [];
    let tmp = [];
    let idCounter = 1;
    for (let index = 0; index < opticsCluster.length; index++) {
      const element = opticsCluster[index];
      if(tmp.length < 1) {
        tmp.push(element);
      }
      else {
        const lastElement = opticsCluster[index-1];
        if(element.properties.reachabilityDistance > lastElement.properties.reachabilityDistance) {
          tmp.push(element);
        }
        else {
          clusterResult.push({id: idCounter, points:tmp, centroid: null})
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



  }

  clusterDbmeans() {
    const centroids:any = this.dbMeansService.clusterDBMeans(this.stayPoints.features, 300, 2);
    this.dbmeansResult = centroids; 
    const dbMeansLayer = L.featureGroup();
    const clusterPoints = centroids.map(c=>c.points);
    let geojsonMarkerOptions = {
      radius: 8,
      fillColor: "#fff",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    };

    clusterPoints.map(cluster=>{
      cluster.map(point=>{
        L.geoJSON(point, {
          pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, geojsonMarkerOptions);
          },
        }).addTo(dbMeansLayer);})
    })

    this.layerControl.addOverlay(dbMeansLayer, "DBMEANS centroids")

  }
  
  clusterDbscan() {
    this.clearMap();
    const cluster = turf.clustersDbscan(
      this.stayPoints,
      this.distance2Threshold / 1000
    );
    const clusterResult = []
    for (let index = 0; index < cluster.features.length; index++) {
      const element = cluster.features[index];
      const clusterId = element.properties.cluster;
      if(element.properties.dbscan !== "noise"){
        if(clusterResult[clusterId] === undefined){
          // create new entry
          const cluster = {id:clusterId, points: [element], centroid:null}
          clusterResult.push(cluster);
        }
        else{
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

    const clusterLayer = L.featureGroup();
    cluster.features.map((feature) => {
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
      let geojsonMarkerOptions = {
        radius: 8,
        fillColor: color,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      };
      if(feature.properties.color !== "black"){
        L.geoJSON(feature, {
          pointToLayer: function (p, latlng) {
            return L.circleMarker(latlng, geojsonMarkerOptions);
          },
        }).addTo(clusterLayer);
      }
    });


    this.layerControl.addOverlay(clusterLayer,"DBSCAN");
  }


  /**MISC */
  // sets stay points and cleans them for further use in clustering

  async loadFile(path) {
    this.loading = true;
    try {
      this.gsmData = await this.dataManager.getGSMTrajectories();
      this.user = await this.dataManager.getAllTrajectories(path);
      this.chicago = await this.dataManager.getChicagoTrajectories();
      console.log("GSM",this.gsmData);
      console.log("GeoLife", this.user);
      console.log("Chicago", this.chicago)
    } catch (error) {
      console.log(error);
    }

    // this.calculateStayPoints();
    // this.clusterDbmeans();
    // this.clusterOptics();
    // this.clusterDbscan();
    // console.log("DBSCAN",this.dbscanResult);
    // console.log("OPTICS",this.opticsResult);
    // console.log("DBMEANS",this.dbmeansResult);
    // this.calculateDbIndex(this.dbscanResult)
    // this.calculateSilhouette(this.dbscanResult);
    // this.loading = false;
    // const new_centroids = []
    // for (let index = 0; index < this.dbmeansResult.length; index++) {
    //   const element = this.dbmeansResult[index];
    //   const newC = await this.osmService.classifyCluster(element);
    //   new_centroids.push(newC);      
    // }
  }

  calculateStayPoints() {
    this.loading = true;
    this.stayPoints = [];
    // get all trajectories in the specified path/filename

    // perform stay point extraction with the input values for time and dist threshold
    this.user.map((trajectory) => {
      const stayPoints = this.staypointService.extractStayPoints(
        trajectory.features,
        this.timeThreshold,
        this.distance1Threshold
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
    console.log("Stay points",this.stayPoints);
    const points = L.layerGroup();
    this.stayPoints.features.map((p) => {
      L.geoJSON(p, {
        pointToLayer: function (p, latlng) {
          return L.circleMarker(latlng, geojsonMarkerOptions);
        },
      }).addTo(points);
    });
    this.layerControl.addOverlay(points, "Stay Points");


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
      const bbox = turf.bbox(hull);
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
    
    //this.applyPPMModel();

    this.arrayPerCluster.map((cluster) => {
      const marker = L.marker(
        cluster.centroid.geometry.coordinates.reverse()
      ).addTo(this.map);
      const popup = L.popup()
        // .setLatLng(cluster.hull.geometry.coordinates[0][0].reverse())
        .setContent(
          `clusterId:${cluster.clusterId}<br> Total points in cluster:${cluster.pointsWithin.features.length}<br>Stay points:${cluster.stayPoints.length}<br>`
        );
      marker.bindPopup(popup);
    });
  }
  clearMap() {
    this.map.eachLayer((layer) => {
      if (layer._url !== "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png") {
        layer.remove();
      }
    });
  }

  calculateDbIndex(clusters){
    this.dbIndexService.dbindex(clusters);
  }

  calculateSilhouette(clusters){
    this.silhouetteService.calculateSilhouette(clusters);
  }

  /** UI HELPER FUNCTIONS */

  

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
  changePath(event) {
    const value = event.target.value;
    this.useFile = value;
  }
  
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
