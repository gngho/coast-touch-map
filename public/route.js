import{DEMO_ROUTE}from'./route-data.js';

// A saved Cabrillo Highway segment. This overlay does not request live routing.
export function addDemoRoute(map){
  const coordinates=DEMO_ROUTE.geometry.coordinates;
  let index=1,distance=Infinity;
  coordinates.forEach((point,i)=>{const d=(point[0]+121.901)**2+(point[1]-36.371)**2;if(d<distance&&i>0&&i<coordinates.length-1){distance=d;index=i;}});
  const remaining=DEMO_ROUTE;
  const before=map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
  map.addSource('coast-route',{type:'geojson',data:remaining});
  const width=['interpolate',['linear'],['zoom'],5,3,13,7,18,14];
  map.addLayer({id:'coast-route-casing',type:'line',source:'coast-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':['+',width,4],'line-opacity':0.96}},before);
  map.addLayer({id:'coast-route-line',type:'line',source:'coast-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#2467e8','line-width':width}},before);

  const element=document.createElement('div');
  element.className='vehicle-marker';element.setAttribute('role','img');element.setAttribute('aria-label','북쪽으로 진행하는 데모 위치');
  const icon=document.createElement('img');icon.src='./icons/navigation-arrow.svg';icon.alt='';icon.width=48;icon.height=48;icon.draggable=false;element.append(icon);
  // Heading-up camera already turns the map. Keep the arrow upright in screen space
  // and preserve fractional pixels rather than rounding its anchor every moveend.
  const marker=new maplibregl.Marker({element,rotation:0,rotationAlignment:'viewport',pitchAlignment:'viewport',subpixelPositioning:true,anchor:'center'}).setLngLat(coordinates[index]).addTo(map);
  const path=coordinates.slice(0,index+1).reverse(),lengths=routeLengths(path);
  let travelled=0,last=null,frame=0,removed=false,cameraHeading=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function draw(dt=0){
    const pose=routePose(path,lengths,travelled);
    // Average nearby route segments so small polyline corners do not snap the camera.
    const behind=routePose(path,lengths,travelled-12).position;
    const ahead=routePose(path,lengths,travelled+24).position;
    const direction=Math.atan2((ahead[0]-behind[0])*Math.cos(pose.position[1]*Math.PI/180),ahead[1]-behind[1])*180/Math.PI;
    cameraHeading=cameraHeading===null?direction:smoothHeading(cameraHeading,direction,dt);
    // Padding keeps the car at 68% of the map height, exposing the road ahead.
    // Do not set zoom here: the participant's +/- and pinch zoom must persist.
    map.jumpTo({center:pose.position,bearing:cameraHeading,pitch:55,padding:{top:map.getContainer().clientHeight*.36,bottom:0,left:0,right:0}});
    marker.setLngLat(pose.position);
    element.dataset.distance=travelled.toFixed(2);
  }
  function tick(now){
    if(removed)return;
    const dt=last===null?0:Math.max(0,Math.min((now-last)/1000,.1));
    if(!document.hidden&&!reduced.matches)travelled=Math.min(lengths.at(-1),travelled+dt*6);
    last=now;if(!document.hidden)draw(reduced.matches?0:dt);frame=requestAnimationFrame(tick);
  }
  function reset(){travelled=0;last=null;cameraHeading=null;draw();}
  draw();
  frame=requestAnimationFrame(tick);
  return {reset,remove(){removed=true;cancelAnimationFrame(frame);marker.remove();}};
}

// Approximate local distances are sufficient for a fixed non-routing visual stimulus.
export function routeLengths(points){
 const distances=[0];for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=(b[0]-a[0])*Math.cos((a[1]+b[1])*.5*Math.PI/180),dy=b[1]-a[1];
  distances.push(distances.at(-1)+Math.hypot(dx,dy)*111195);
 }return distances;
}

// Follow the shortest arc across north; exponential damping is frame-rate independent.
export function smoothHeading(current,target,seconds){
 const delta=((target-current+540)%360+360)%360-180;
 return current+delta*(1-Math.exp(-Math.max(0,seconds)/.8));
}
export function routePose(points,lengths,distance){
 const d=Math.max(0,Math.min(distance,lengths.at(-1)));let i=1;
 while(i<lengths.length-1&&lengths[i]<d)i++;
 const a=points[i-1],b=points[i],ratio=(d-lengths[i-1])/(lengths[i]-lengths[i-1]||1);
 return {position:[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio],heading:Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI};
}
