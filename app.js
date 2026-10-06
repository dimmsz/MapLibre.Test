import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const DEFAULT_STYLE_URL='https://tiles.openfreemap.org/styles/liberty';

let map;
let currentStyle=null;
const $=s=>document.querySelector(s);
const els={lng:$('#lng'),lat:$('#lat'),zoom:$('#zoom'),layers:$('#layers'),json:$('#style-json'),status:$('#status')};
const status=s=>els.status.textContent=s;
const getLayer=id=>currentStyle?.layers.find(x=>x.id===id);
const isVisible=id=>getLayer(id)?.layout?.visibility!=='none';
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function syncCamera(){
 if(!map)return;
 const c=map.getCenter();
 els.lng.value=c.lng.toFixed(6);
 els.lat.value=c.lat.toFixed(6);
 els.zoom.value=map.getZoom().toFixed(2);
}

function renderLayers(){
 if(!currentStyle)return;
 els.layers.innerHTML='';
 currentStyle.layers.forEach(l=>{
  const c=document.createElement('div');
  c.className='layer-card';
  const color=l.type==='line'?l.paint?.['line-color']:l.type==='fill'?l.paint?.['fill-color']:l.paint?.['text-color'];
  const opacity=l.type==='line'?l.paint?.['line-opacity']??1:l.type==='fill'?l.paint?.['fill-opacity']??1:l.paint?.['text-opacity']??1;
  c.innerHTML='<div class="layer-head"><input type="checkbox" data-f="visible" '+(isVisible(l.id)?'checked':'')+'><strong>'+esc(l.id)+'</strong><small>'+esc(l.type)+'</small></div>'+
  '<div class="layer-fields"><label class="wide">source-layer<input data-f="sourceLayer" value="'+esc(l['source-layer']||'')+'"></label>'+
  '<label>color<input type="color" data-f="color" value="'+(typeof color==='string'&&color.startsWith('#')?color:'#ffffff')+'"></label>'+
  '<label>opacity<input type="number" min="0" max="1" step="0.05" data-f="opacity" value="'+opacity+'"></label>'+
  '<label>minzoom<input type="number" step="0.5" data-f="minzoom" value="'+(l.minzoom??0)+'"></label>'+
  '<label>maxzoom<input type="number" step="0.5" data-f="maxzoom" value="'+(l.maxzoom??24)+'"></label>'+
  (l.type==='line'?'<label>width<input type="number" min="0" step="0.5" data-f="width" value="'+(typeof l.paint?.['line-width']==='number'?l.paint['line-width']:1)+'"></label>':'')+
  '</div><div class="layer-actions"><button data-a="duplicate">複製</button><button data-a="up">↑</button><button data-a="down">↓</button><button class="secondary" data-a="delete">削除</button></div>';
  c.addEventListener('input',e=>updateLayer(l.id,e.target));
  c.addEventListener('change',e=>updateLayer(l.id,e.target));
  c.addEventListener('click',e=>actionLayer(l.id,e.target.dataset.a));
  els.layers.appendChild(c);
 });
}

function updateLayer(id,input){
 const l=getLayer(id);
 if(!l||!input.dataset.f)return;
 l.layout??={};
 l.paint??={};
 const f=input.dataset.f;
 if(f==='visible')l.layout.visibility=input.checked?'visible':'none';
 if(f==='sourceLayer'){if(input.value)l['source-layer']=input.value;else delete l['source-layer']}
 if(f==='color'){
  const key=l.type==='line'?'line-color':l.type==='fill'?'fill-color':l.type==='symbol'?'text-color':null;
  if(key)l.paint[key]=input.value;
 }
 if(f==='opacity'){
  const key=l.type==='line'?'line-opacity':l.type==='fill'?'fill-opacity':l.type==='symbol'?'text-opacity':null;
  if(key)l.paint[key]=Number(input.value);
 }
 if(f==='width'&&l.type==='line')l.paint['line-width']=Number(input.value);
 if(f==='minzoom')l.minzoom=Number(input.value);
 if(f==='maxzoom')l.maxzoom=Number(input.value);
 applyStyle();
}

function actionLayer(id,a){
 const i=currentStyle.layers.findIndex(x=>x.id===id);
 if(i<0)return;
 if(a==='delete')currentStyle.layers.splice(i,1);
 if(a==='up'&&i>0)[currentStyle.layers[i-1],currentStyle.layers[i]]=[currentStyle.layers[i],currentStyle.layers[i-1]];
 if(a==='down'&&i<currentStyle.layers.length-1)[currentStyle.layers[i+1],currentStyle.layers[i]]=[currentStyle.layers[i],currentStyle.layers[i+1]];
 if(a==='duplicate'){
  const x=structuredClone(currentStyle.layers[i]);
  x.id=id+'-copy-'+Date.now().toString(36);
  currentStyle.layers.splice(i+1,0,x);
 }
 applyStyle();
}

function applyStyle(){
 if(!map||!currentStyle)return;
 const cam={center:map.getCenter().toArray(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()};
 map.setStyle(structuredClone(currentStyle),{diff:false});
 map.once('styledata',()=>{
  map.jumpTo(cam);
  els.json.value=JSON.stringify(currentStyle,null,2);
  renderLayers();
  status('MapLibre GL JS '+maplibregl.getVersion()+'\nレイヤー: '+currentStyle.layers.length+'\nソース: '+Object.keys(currentStyle.sources||{}).length);
 });
}

async function loadDefaultStyle(){
 localStorage.removeItem('maplibre.style');
 map.setStyle(DEFAULT_STYLE_URL);
 map.once('styledata',()=>{
  currentStyle=structuredClone(map.getStyle());
  els.json.value=JSON.stringify(currentStyle,null,2);
  renderLayers();
  status('OpenFreeMap / MapLibre GL JS '+maplibregl.getVersion()+'\nAPIキー不要');
 });
}

$('#apply-style').onclick=()=>{
 try{
  const x=JSON.parse(els.json.value);
  if(x.version!==8)throw Error('style.version は8が必要です');
  currentStyle=x;
  applyStyle();
 }catch(e){status('JSONエラー: '+e.message)}
};

$('#reset-button').onclick=loadDefaultStyle;

$('#add-layer').onclick=()=>{
 if(!currentStyle)return;
 const sourceId=Object.keys(currentStyle.sources||{})[0];
 const source=sourceId?currentStyle.sources[sourceId]:null;
 const sourceLayer=currentStyle.layers.find(x=>x['source-layer'])?.['source-layer'];
 currentStyle.layers.push({
  id:'test-line-'+Date.now().toString(36),
  type:'line',
  source:sourceId,
  'source-layer':sourceLayer,
  paint:{'line-color':'#ff00aa','line-width':4,'line-opacity':.7}
 });
 applyStyle();
};

$('#fly-home').onclick=()=>map.flyTo({center:[136.9066,35.1815],zoom:11});
$('#save-button').onclick=()=>{
 localStorage.setItem('maplibre.style',JSON.stringify(currentStyle));
 status('localStorageへ設定を保存しました');
};

['lng','lat','zoom'].forEach(id=>els[id].addEventListener('change',()=>{
 map.flyTo({center:[Number(els.lng.value),Number(els.lat.value)],zoom:Number(els.zoom.value)});
}));

map=new maplibregl.Map({
 container:'map',
 style:DEFAULT_STYLE_URL,
 center:[136.9066,35.1815],
 zoom:11
});

map.addControl(new maplibregl.NavigationControl(),'top-right');
map.on('move',syncCamera);
map.on('error',e=>status('Map error: '+(e.error?.message||'地図データの読み込みに失敗しました')));
map.on('load',()=>{
 currentStyle=structuredClone(map.getStyle());
 els.json.value=JSON.stringify(currentStyle,null,2);
 renderLayers();
 syncCamera();
 status('OpenFreeMap / MapLibre GL JS '+maplibregl.getVersion()+'\nAPIキー不要');
});
