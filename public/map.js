import{addDemoRoute}from'./route.js';
export const INITIAL_VIEW={center:[-121.901,36.371],zoom:14.5,bearing:0,pitch:55};
export function createCoastMap({labels,onStatus,onZoom}){
  let map,vehicle,timeout,showLabels=labels,disposed=false;
  const setLabels=value=>{showLabels=value;if(!map?.isStyleLoaded())return;for(const layer of map.getStyle().layers){if(layer.type==='symbol'&&layer.layout?.['text-field'])map.setLayoutProperty(layer.id,'visibility',value?'visible':'none');}};
  function initialize(){
    clearTimeout(timeout);vehicle?.remove();map?.remove();onStatus('loading');
    try{
      map=new maplibregl.Map({container:'map',style:'./styles/coast.json',...INITIAL_VIEW,minZoom:5,maxZoom:18,attributionControl:false,dragRotate:false,pitchWithRotate:false,touchPitch:false,renderWorldCopies:false,locale:{'AttributionControl.ToggleAttribution':'지도 출처 표시'}});
      map.touchZoomRotate.disableRotation();map.keyboard.disableRotation();map.dragPan.disable();
      map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
      map.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
      map.on('style.load',()=>{vehicle?.remove();vehicle=addDemoRoute(map);setLabels(showLabels);});
      map.on('load',()=>{clearTimeout(timeout);onStatus('ready');});
      map.on('idle',()=>{if(map.areTilesLoaded()&&navigator.onLine){clearTimeout(timeout);onStatus('ready');}});
      map.on('error',()=>onStatus('error'));
      map.on('zoom',()=>onZoom(map.getZoom()));
      map.on('rotate',()=>{const needle=document.querySelector('.north-needle');if(needle)needle.style.transform=`rotate(${-map.getBearing()}deg)`;});
      onZoom(INITIAL_VIEW.zoom);
      timeout=setTimeout(()=>onStatus('error'),20000);
    }catch{onStatus('error');}
  }
  const offline=()=>onStatus('error');
  window.addEventListener('offline',offline);
  initialize();
  return{zoomBy(amount){if(map)map.jumpTo({zoom:Math.max(5,Math.min(18,map.getZoom()+amount))});},reset(){map?.jumpTo(INITIAL_VIEW);vehicle?.reset();},setLabels,retry(){if(!disposed)initialize();},destroy(){disposed=true;clearTimeout(timeout);vehicle?.remove();map?.remove();window.removeEventListener('offline',offline);}};
}
