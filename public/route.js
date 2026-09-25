import{DEMO_ROUTE}from'./route-data.js';

// A saved Cabrillo Highway segment. This overlay does not request live routing.
export function addDemoRoute(map){
  const before=map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
  map.addSource('coast-route',{type:'geojson',data:DEMO_ROUTE});
  const width=['interpolate',['linear'],['zoom'],5,3,13,7,18,14];
  map.addLayer({id:'coast-route-casing',type:'line',source:'coast-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':['+',width,4],'line-opacity':0.96}},before);
  map.addLayer({id:'coast-route-line',type:'line',source:'coast-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#2467e8','line-width':width}},before);

  const coordinates=DEMO_ROUTE.geometry.coordinates;
  let index=1,distance=Infinity;
  coordinates.forEach((point,i)=>{const d=(point[0]+121.901)**2+(point[1]-36.371)**2;if(d<distance&&i>0&&i<coordinates.length-1){distance=d;index=i;}});
  const a=coordinates[index-1],b=coordinates[index+1];
  const heading=Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI;
  const element=document.createElement('div');
  element.className='vehicle-marker';element.setAttribute('role','img');element.setAttribute('aria-label','데모 차량 위치');
  const icon=document.createElement('img');icon.src='./icons/vehicle.svg';icon.alt='';icon.width=44;icon.height=64;icon.draggable=false;element.append(icon);
  return new maplibregl.Marker({element,rotation:heading,rotationAlignment:'map',pitchAlignment:'map',anchor:'center'}).setLngLat(coordinates[index]).addTo(map);
}
