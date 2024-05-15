import {
  insertPolygonTree,
  isInside,
  naverPolygonToJstsPolygon,
  searchSnapPoint,
} from "./common";
import { treeStore } from "./store";

export class Polygon {
  map: naver.maps.Map;
  path: naver.maps.LatLng[];
  poly: naver.maps.Polygon;
  eventListeners: naver.maps.MapEventListener[];

  constructor(
    map: naver.maps.Map,
    options: Omit<naver.maps.PolygonOptions, "map" | "paths">
  ) {
    this.map = map;
    this.path = [];
    this.poly = new naver.maps.Polygon({
      map,
      paths: [this.path],
      ...options,
    });
    this.eventListeners = [];
    this.eventListeners.push(this.addHandleClick(), this.addHandleMove());
    this.final();
  }

  clear() {
    naver.maps.Event.removeListener(this.eventListeners);
  }

  addTree() {
    const polygonTree = treeStore.getState().polygonTree;
    const polygon = naverPolygonToJstsPolygon(this.poly);
    insertPolygonTree(polygonTree, polygon);
  }

  addHandleClick() {
    return this.map.addListener("click", (e) => {
      this.path.push(e.latlng);
      if (this.path.length === 1) {
        this.path.push(e.latlng);
      }
      this.poly.setPath(this.path);
    });
  }

  addHandleMove() {
    return this.map.addListener("mousemove", (e) => {
      const polygonTree = treeStore.getState().polygonTree;
      const snapPoint = searchSnapPoint(polygonTree, e.latlng);

      const mp = snapPoint
        ? new naver.maps.LatLng(snapPoint[1], snapPoint[0])
        : e.latlng;
      this.path.pop();
      this.path.push(mp);
      this.poly.setPath(this.path);
    });
  }

  final() {
    this.map.addListenerOnce("rightclick", () => {
      this.clear();
      this.path.pop();
      this.poly.setPath(this.path);
      this.addTree();
    });
  }
}

export class InPolygon extends Polygon {
  addTree(): void {}
  addHandleMove(): naver.maps.MapEventListener {
    return this.map.addListener("mousemove", (e) => {
      const polygonTree = treeStore.getState().polygonTree;
      const snapPoint = searchSnapPoint(polygonTree, e.latlng);

      if (snapPoint === undefined && !isInside(polygonTree, e.latlng)) return;

      const mp = snapPoint
        ? new naver.maps.LatLng(snapPoint[1], snapPoint[0])
        : e.latlng;
      this.path.pop();
      this.path.push(mp);
      this.poly.setPath(this.path);
    });
  }
}

export class OutPolygon extends Polygon {
  addTree(): void {}
  addHandleMove(): naver.maps.MapEventListener {
    return this.map.addListener("mousemove", (e) => {
      const polygonTree = treeStore.getState().polygonTree;
      const snapPoint = searchSnapPoint(polygonTree, e.latlng);

      if (snapPoint === undefined && isInside(polygonTree, e.latlng)) return;

      const mp = snapPoint
        ? new naver.maps.LatLng(snapPoint[1], snapPoint[0])
        : e.latlng;
      this.path.pop();
      this.path.push(mp);
      this.poly.setPath(this.path);
    });
  }
}
