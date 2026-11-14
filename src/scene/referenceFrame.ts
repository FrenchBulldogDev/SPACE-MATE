import { Matrix4, Quaternion, Vector3 } from 'three';
import { METERS_PER_SCENE_UNIT, PHYSICS } from '../config';
import { interpolateEphemeris, evaluateHermite, hermiteCoefficients } from '../science/ephemeris';
import type { DisplayMode, Ephemeris, Vec3 } from '../science/types';
import { cross, normalize, scale, terrestrialBasis } from '../science/vectors';

// The only ICRF -> renderer mapping. Right-handed permutation, NOT a new
// astronomical reference frame: X -> X, equatorial Y -> -Z, north Z -> +Y.
export const icrfToScene = ([x, y, z]: Vec3) => new Vector3(x, z, -y);
export const distanceDisplayScale = (mode: DisplayMode) => mode === 'public' ? 8.8 * METERS_PER_SCENE_UNIT / PHYSICS.meanEarthMoonDistanceMeters : 1;
export const displayedPosition = (position: Vec3, mode: DisplayMode) => icrfToScene(position).multiplyScalar(distanceDisplayScale(mode) / METERS_PER_SCENE_UNIT);

export function frameAt(data: Ephemeris, time: number, mode: DisplayMode) {
  const p = interpolateEphemeris(data, time);
  const basis = terrestrialBasis(p.greenwich, p.northPole);
  // Body local axes: X Greenwich, Y north, Z west. Same transform for surface
  // pins, texture longitudes, the Earth model and the physical lunar vectors.
  const earthOrientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
    icrfToScene(basis.x.position), icrfToScene(basis.z.position), icrfToScene(scale(basis.y.position, -1)),
  ));
  const nearSide = normalize(scale(p.moon.position, -1));
  const north = normalize(cross(p.moon.position, p.moon.velocity));
  const west = normalize(cross(nearSide, north));
  const lunarNorth = cross(west, nearSide);
  let moonOrientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(icrfToScene(nearSide), icrfToScene(lunarNorth), icrfToScene(west)));
  const attitudes=data.lunarAttitudes;
  if(attitudes?.length){
    let low=0,high=attitudes.length-1;while(low+1<high){const mid=(low+high)>>1;if(attitudes[mid].time<=time)low=mid;else high=mid;}
    const a=attitudes[low],b=attitudes[low+1];
    if(time<a.time||time>b.time)throw new Error('Lunar attitude outside coverage');
    const dt=(b.time-a.time)/1000,u=(time-a.time)/(b.time-a.time);
    const frame=terrestrialBasis(evaluateHermite(hermiteCoefficients(a.greenwich,b.greenwich,dt),u,dt),evaluateHermite(hermiteCoefficients(a.northPole,b.northPole,dt),u,dt));
    moonOrientation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(icrfToScene(frame.x.position),icrfToScene(frame.z.position),icrfToScene(scale(frame.y.position,-1))));
  }
  return { earth: new Vector3(), moon: displayedPosition(p.moon.position, mode), earthOrientation, moonOrientation };
}
