import test from 'node:test';
import assert from 'node:assert/strict';
import {addDemoRoute,routeLengths,routePose,smoothHeading} from '../public/route.js';
import {DEMO_ROUTE} from '../public/route-data.js';
test('route marker interpolates on segments and clamps at endpoints',()=>{
 const points=[[0,0],[0,.001],[.001,.001]],lengths=routeLengths(points);
 assert.deepEqual(routePose(points,lengths,0).position,points[0]);
 assert.deepEqual(routePose(points,lengths,1e6).position,points[2]);
 assert.ok(Math.abs(routePose(points,lengths,lengths[1]/2).position[1]-.0005)<1e-9);
 assert.equal(routePose(points,lengths,lengths[1]/2).heading,0);
 assert.ok(Math.abs(routePose(points,lengths,(lengths[1]+lengths[2])/2).heading-90)<1e-6);
});

test('camera heading crosses north along the short arc and is independent of frame rate',()=>{
 const next=smoothHeading(179,-179,.1);
 assert.ok(next>179&&next<181);
 assert.ok(smoothHeading(-179,179,.1)<-179);
 let fine=20;for(let i=0;i<60;i++)fine=smoothHeading(fine,100,1/60);
 assert.ok(Math.abs(fine-smoothHeading(20,100,1))<1e-9);
 assert.equal(smoothHeading(20,100,0),20);
});

test('vehicle camera follows the entire drive, retains zoom, resets, and respects reduced motion',t=>{
 let callback,position,markerOptions,camera,removed=false,height=800;
 const preference={matches:false};
 for(const key of ['document','matchMedia','requestAnimationFrame','cancelAnimationFrame','maplibregl']){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
  t.after(()=>descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key]);
 }
 globalThis.document={hidden:false,createElement:()=>({setAttribute(){},append(){},dataset:{}})};
 globalThis.matchMedia=()=>preference;
 globalThis.requestAnimationFrame=fn=>{callback=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
 globalThis.maplibregl={Marker:class{constructor(options){markerOptions=options;}setLngLat(p){position=p;return this;}addTo(){return this;}remove(){removed=true;}}};
 const map={getStyle:()=>({layers:[]}),addSource(){},addLayer(){},getContainer:()=>({clientHeight:height}),jumpTo:c=>{camera=c;}};
 const route=addDemoRoute(map),start=[...position];
 assert.equal(markerOptions.subpixelPositioning,true);
 assert.equal(markerOptions.rotationAlignment,'viewport');
 assert.equal(markerOptions.rotation,0);
 for(let i=0;i<6000;i++){
  callback(i*100);
  assert.deepEqual(camera.center,position);
  assert.ok(Number.isFinite(camera.bearing));
  assert.equal(camera.pitch,55);
  assert.equal(camera.zoom,undefined);
 }
 assert.notDeepEqual(position,start);
 const stopped=[...position];preference.matches=true;callback(600000);assert.deepEqual(position,stopped);
 preference.matches=false;document.hidden=true;callback(600100);assert.deepEqual(position,stopped);
 document.hidden=false;height=600;route.reset();assert.deepEqual(position,start);assert.equal(camera.padding.top,216);
 route.remove();assert.equal(removed,true);
});

test('saved road geometry extends over 100 km with a continuous join and hours of forward travel',()=>{
 const points=DEMO_ROUTE.geometry.coordinates,lengths=routeLengths(points);
 assert.ok(lengths.at(-1)>100000);
 assert.ok(Math.abs(lengths.at(-1)-DEMO_ROUTE.properties.distanceMeters)<1000);
 let index=0,best=Infinity;
 points.forEach((p,i)=>{const d=(p[0]+121.901)**2+(p[1]-36.371)**2;if(d<best){best=d;index=i;}});
 assert.ok(lengths[index]>90000,'more than four hours of forward travel at 6 m/s');
 for(let i=1;i<lengths.length;i++)assert.ok(lengths[i]-lengths[i-1]<1500,'no disconnected long jumps');
});
