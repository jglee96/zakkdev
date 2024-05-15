import RBush from "rbush";
import proj4 from "proj4";
import * as jsts from "jsts";

const PROJ_LL = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";
const PROJ_TM =
  "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs";

export type PolygonTreeObject = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  value: jsts.geom.Polygon;
};

export type LineTreeObject = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  value: jsts.geom.LineString;
};

const bufferSize = 2;

const factory = new jsts.geom.GeometryFactory();

export const isInside = (
  tree: RBush<PolygonTreeObject>,
  latlng: naver.maps.LatLng
) => {
  const p1 = latlng.destinationPoint(135, bufferSize);
  const p2 = latlng.destinationPoint(315, bufferSize);

  const t1 = proj4(PROJ_LL, PROJ_TM, [p1.x, p1.y]);
  const t2 = proj4(PROJ_LL, PROJ_TM, [p2.x, p2.y]);
  const searchObject = {
    minX: Math.min(t1[0], t2[0]),
    minY: Math.min(t1[1], t2[1]),
    maxX: Math.max(t1[0], t2[0]),
    maxY: Math.max(t1[1], t2[1]),
  };

  const result = tree.search(searchObject);

  if (result.length === 0) return undefined;

  const p = proj4(PROJ_LL, PROJ_TM, [latlng.x, latlng.y]);
  const point = factory.createPoint(new jsts.geom.Coordinate(p[0], p[1]));

  return result.filter((item) => item.value.covers(point)).length > 0;
};

export const insertPolygonTree = (
  tree: RBush<PolygonTreeObject>,
  polygon: jsts.geom.Polygon
) => {
  const env = polygon.getEnvelopeInternal();

  const item = {
    minX: env.getMinX(),
    minY: env.getMinY(),
    maxX: env.getMaxX(),
    maxY: env.getMaxY(),
    value: polygon,
  };
  tree.insert(item);
};

export const insertLineTree = (
  tree: RBush<LineTreeObject>,
  p1: naver.maps.LatLng,
  p2: naver.maps.LatLng
) => {
  const t1 = proj4(PROJ_LL, PROJ_TM, [p1.x, p1.y]);
  const t2 = proj4(PROJ_LL, PROJ_TM, [p2.x, p2.y]);

  const lineStr = factory.createLineString([
    new jsts.geom.Coordinate(t1[0], t1[1]),
    new jsts.geom.Coordinate(t2[0], t2[1]),
  ]);

  const env = lineStr
    .buffer(bufferSize, 2, jsts.operation.buffer.BufferParameters.CAP_FLAT)
    .getEnvelopeInternal();

  const item = {
    minX: env.getMinX(),
    minY: env.getMinY(),
    maxX: env.getMaxX(),
    maxY: env.getMaxY(),
    value: lineStr,
  };
  tree.insert(item);
};

export const searchSnapPoint = (
  tree: RBush<PolygonTreeObject>,
  latlng: naver.maps.LatLng
): undefined | number[] => {
  const p1 = latlng.destinationPoint(135, bufferSize);
  const p2 = latlng.destinationPoint(315, bufferSize);

  const t1 = proj4(PROJ_LL, PROJ_TM, [p1.x, p1.y]);
  const t2 = proj4(PROJ_LL, PROJ_TM, [p2.x, p2.y]);
  const searchObject = {
    minX: Math.min(t1[0], t2[0]),
    minY: Math.min(t1[1], t2[1]),
    maxX: Math.max(t1[0], t2[0]),
    maxY: Math.max(t1[1], t2[1]),
  };

  const result = tree.search(searchObject);

  if (result.length === 0) return undefined;

  const p = proj4(PROJ_LL, PROJ_TM, [latlng.x, latlng.y]);
  const point = factory.createPoint(new jsts.geom.Coordinate(p[0], p[1]));

  const comp = result.map((item) => ({
    distance: jsts.operation.distance.DistanceOp.distance(item.value, point),
    poly: item.value,
  }));

  comp.sort((a, b) => a.distance - b.distance);

  const lineTree = new RBush<LineTreeObject>();
  const nearestPolygon = comp[0].poly;
  const exteriorCoordinates = nearestPolygon.getExteriorRing().getCoordinates();
  exteriorCoordinates.forEach((coord, index) => {
    if (index === exteriorCoordinates.length - 1) return;
    const lineStr = factory.createLineString([
      coord,
      exteriorCoordinates[index + 1],
    ]);
    const env = lineStr.buffer(bufferSize).getEnvelopeInternal();

    lineTree.insert({
      minX: env.getMinX(),
      minY: env.getMinY(),
      maxX: env.getMaxX(),
      maxY: env.getMaxY(),
      value: lineStr,
    });
  });

  const lineResult = lineTree.search(searchObject);
  if (lineResult.length === 0) return undefined;

  const lineComp = lineResult.map((item) => ({
    distance: jsts.operation.distance.DistanceOp.distance(item.value, point),
    poly: item.value,
  }));
  lineComp.sort((a, b) => a.distance - b.distance);

  const nearestLine = lineComp[0].poly;
  const dist0 = jsts.operation.distance.DistanceOp.distance(
    nearestLine.getStartPoint(),
    point
  );
  const dist1 = jsts.operation.distance.DistanceOp.distance(
    nearestLine.getEndPoint(),
    point
  );

  let snapPoint: jsts.geom.Coordinate;
  if (dist0 < 2 * bufferSize || dist1 < 2 * bufferSize) {
    snapPoint =
      dist0 <= dist1
        ? nearestLine.getStartPoint().getCoordinate()
        : nearestLine.getEndPoint().getCoordinate();
  } else {
    const [c1, c2] = jsts.operation.distance.DistanceOp.nearestPoints(
      nearestLine,
      point
    );
    snapPoint =
      c1.compareTo(new jsts.geom.Coordinate(latlng.x, latlng.y)) === 0
        ? c2
        : c1;
  }
  return proj4(PROJ_TM, PROJ_LL, [snapPoint.x, snapPoint.y]);
};

export const naverPolygonToJstsPolygon = (polygon: naver.maps.Polygon) => {
  const coords = (polygon.getPath() as naver.maps.KVOArrayOfCoords)
    .getArray()
    .map((coord) => proj4(PROJ_LL, PROJ_TM, [coord.x, coord.y]))
    .reduce(
      (acc: jsts.geom.Coordinate[], cur) => [
        ...acc,
        new jsts.geom.Coordinate(cur[0], cur[1]),
      ],
      []
    );
  coords.push(coords[0]);

  return factory.createPolygon(coords);
};
