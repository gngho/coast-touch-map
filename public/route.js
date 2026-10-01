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

  const a=coordinates[index+1],b=coordinates[index-1];
  const heading=Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI;
  const element=document.createElement('div');
  element.className='vehicle-marker';element.setAttribute('role','img');element.setAttribute('aria-label','북쪽으로 진행하는 데모 위치');
  const icon=document.createElement('img');icon.src='./icons/navigation-arrow.svg';icon.alt='';icon.width=48;icon.height=48;icon.draggable=false;element.append(icon);
  const marker=new maplibregl.Marker({element,rotation:heading,rotationAlignment:'map',pitchAlignment:'map',anchor:'center'}).setLngLat(coordinates[index]).addTo(map);
  const path=coordinates.slice(0,index+1).reverse(),lengths=routeLengths(path);
  let travelled=0,last=null,frame=0,removed=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function draw(){
    const pose=routePose(path,lengths,travelled);
    marker.setLngLat(pose.position).setRotation(pose.heading);
    element.dataset.distance=travelled.toFixed(2);
  }
  function tick(now){
    if(removed)return;
    if(last!==null&&!document.hidden&&!reduced.matches)travelled=Math.min(lengths.at(-1),travelled+Math.min((now-last)/1000,.1)*6);
    last=now;draw();frame=requestAnimationFrame(tick);
  }
  function reset(){travelled=0;last=null;draw();}
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
export function routePose(points,lengths,distance){
 const d=Math.max(0,Math.min(distance,lengths.at(-1)));let i=1;
 while(i<lengths.length-1&&lengths[i]<d)i++;
 const a=points[i-1],b=points[i],ratio=(d-lengths[i-1])/(lengths[i]-lengths[i-1]||1);
 return {position:[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio],heading:Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI};
}
