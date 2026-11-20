import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import {
  loading,loadingMessage,controlHint,centerHint,workTimer,artUpload,artModal,artPreview,artMeta,
  artLikeBtn,artArchiveSection,artArchiveTitle,artArchiveGrid,artClose,historyBtn,historyModal,
  historyClose,currentProgressSection,historySummary,historyGrid,progressCarousel,progressMeta,
  completeWorkBtn,deleteCurrentWorkBtn,completedGrid,accountBtn,accountModal,accountClose,
  accountEmail,accountAction,logoutBtn,accountState,IS_KO,t,applyLocaleUI,showStatus
} from './ui.js';
import {
  IS_MOBILE_RENDER,ARTWORK_HOLD_MS,PRESENCE_PULSE_MS,PRESENCE_POLL_MS,HEARTBEAT_MS,SNOW_COUNT
} from './config.js';
import {supabase,SUPABASE_URL} from './backend.js';
import {getOrCreateClientId,getOrCreateDisplayName,makeLocalizedDisplayName,saveDisplayName} from './identity.js';
import {fetchWorldState,claimEasel,releaseEasel,heartbeatEasel,upsertPresence,fetchPresence,deletePresence} from './multiplayer-api.js';
import {findActiveWorkRow,createActiveWorkRow,uploadArtworkFile,completeWorkRow,fetchHistoryBundle,fetchWorkById,fetchCompletedWorks} from './artwork-api.js';
import {adoptGuestData,fetchProfile,updateProfileName,createProfile,getAuthSession,sendMagicLink,signOut} from './account-api.js';
import {remainingExhibitionText,isArtworkLocked,blockedEaselStatus,blockedEaselPrompts} from './easel-policy.js';
import {formatDuration,formatTodayWork} from './time-format.js';
import {normalizeAvatarOrigin,isolateAvatarMaterials,recolorBeret} from './avatar-utils.js';
import {constrainWalkable as constrainWalkableByConfig,facingYaw} from './movement-geometry.js';
import {makeArtworkOverlay} from './artwork-render.js';
import {makeStarGlowTexture,makeWarmGlowTexture,makeWaterNormalTexture} from './texture-factory.js';
import {createWorkPromptController} from './work-prompt.js';

applyLocaleUI();

const loadingCopiesKo=[
  '화실에 입장하는 중...',
  '오늘도 같이 그림 그리자...',
  '누군가 네 그림을 기다리고 있어'
];
const loadingCopiesEn=[
  'Entering the atelier...',
  'Let’s paint together today...',
  'Someone is waiting to see your art'
];
let loadingCopyIndex=0;
const loadingCopies=IS_KO?loadingCopiesKo:loadingCopiesEn;
loadingMessage.textContent=loadingCopies[0];
const loadingCopyTimer=setInterval(()=>{
  if(!loading || loading.style.display==='none')return;
  loadingMessage.classList.add('swap');
  setTimeout(()=>{
    loadingCopyIndex=(loadingCopyIndex+1)%loadingCopies.length;
    loadingMessage.textContent=loadingCopies[loadingCopyIndex];
    loadingMessage.classList.remove('swap');
  },280);
},1650);

setTimeout(()=>controlHint.classList.add('show'),700);
setTimeout(()=>controlHint.classList.remove('show'),6200);
setTimeout(()=>{
  if(playerSeat)return;
  centerHint.textContent=t('빈 이젤을 클릭해 앉아보세요','Click an empty easel to sit down');
  centerHint.classList.add('show');
},6900);
setTimeout(()=>centerHint.classList.remove('show'),10200);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xd8e6ee);
const workPromptController=createWorkPromptController(scene);

const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.05,200);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,IS_MOBILE_RENDER?1.35:2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.92;
document.getElementById('app').appendChild(renderer.domElement);

const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
scene.environmentIntensity=.38;

const hemi=new THREE.HemisphereLight(0xfff5e9,0x758797,1.08);
scene.add(hemi);

const sun=new THREE.DirectionalLight(0xffddb5,1.72);
sun.position.set(-8,10,-4);
sun.castShadow=true;
sun.shadow.mapSize.set(IS_MOBILE_RENDER?1024:2048,IS_MOBILE_RENDER?1024:2048);
sun.shadow.camera.near=.5;
sun.shadow.camera.far=35;
sun.shadow.camera.left=-9;
sun.shadow.camera.right=9;
sun.shadow.camera.top=9;
sun.shadow.camera.bottom=-9;
sun.shadow.bias=-.00035;
scene.add(sun);

const fill=new THREE.DirectionalLight(0xc6ddff,.35);
fill.position.set(6,5,5);
scene.add(fill);

const DAY_SKY=new THREE.Color(0xd8e6ee);
const NIGHT_SKY=new THREE.Color(0x08111f);
let nightFactor=0;
let lastNightLightingUpdate=0;
const skyClouds=[];
const waterCloudReflections=[];

const starGlowTexture=makeStarGlowTexture();

function makeClusteredStarLayer(count,size,color,clusterBias=.72){
  const pos=new Float32Array(count*3);
  const colors=new Float32Array(count*3);
  const phases=new Float32Array(count);
  const speeds=new Float32Array(count);
  const baseColor=new THREE.Color(color);
  const clusters=[
    {a:.35,y:18},{a:1.15,y:24},{a:2.05,y:15},{a:2.9,y:26},
    {a:3.85,y:20},{a:4.65,y:28},{a:5.35,y:16},{a:5.9,y:23}
  ];
  for(let i=0;i<count;i++){
    let ang,y;
    if(Math.random()<clusterBias){
      const c=clusters[Math.floor(Math.random()*clusters.length)];
      ang=c.a+(Math.random()-.5)*.48;
      y=c.y+(Math.random()-.5)*6.2;
    }else{
      ang=Math.random()*Math.PI*2;
      y=10+Math.random()*20;
    }
    const r=24+Math.random()*20;
    pos[i*3]=Math.cos(ang)*r;
    pos[i*3+1]=y;
    pos[i*3+2]=Math.sin(ang)*r;
    phases[i]=Math.random()*Math.PI*2;
    speeds[i]=.5+Math.random()*1.7;
    colors[i*3]=baseColor.r;
    colors[i*3+1]=baseColor.g;
    colors[i*3+2]=baseColor.b;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const m=new THREE.PointsMaterial({
    color:0xffffff,
    size:size*2.6,
    map:starGlowTexture,
    vertexColors:true,
    transparent:true,
    opacity:0,
    depthWrite:false,
    depthTest:true,
    sizeAttenuation:true,
    blending:THREE.AdditiveBlending
  });
  const stars=new THREE.Points(g,m);
  stars.frustumCulled=false;
  stars.userData.baseColor=baseColor;
  stars.userData.phases=phases;
  stars.userData.speeds=speeds;
  return stars;
}

function createStarField(){
  const group=new THREE.Group();
  group.name='Atelier Stars';
  const palette=[0xfff7d6,0xffefb3,0xffe49a,0xfff2c2];
  for(let i=0;i<10;i++){
    group.add(makeClusteredStarLayer(
      42+Math.floor(Math.random()*28),
      .055+Math.random()*.10,
      palette[i%palette.length],
      .60+Math.random()*.28
    ));
  }
  for(let i=0;i<3;i++){
    const hero=makeClusteredStarLayer(
      14+Math.floor(Math.random()*8),
      .16+Math.random()*.09,
      i%2?0xffe7a6:0xfff6cf,
      .45+Math.random()*.22
    );
    hero.userData.twinkleStrength=.34+Math.random()*.18;
    hero.userData.twinkleSpeed=.22+Math.random()*.35;
    hero.userData.baseOpacity=.72+Math.random()*.18;
    group.add(hero);
  }
  scene.add(group);
  return group;
}
const starField=createStarField();

function updateStarTwinkle(nowMs){
  if(!starField.visible)return;
  const t=nowMs*.001;
  const nightOpacity=Math.max(0,(nightFactor-.12)/.88);

  for(let layerIndex=0;layerIndex<starField.children.length;layerIndex++){
    const layer=starField.children[layerIndex];
    const attr=layer.geometry.attributes.color;
    const {baseColor,phases,speeds}=layer.userData;

    let avgWave=0;
    for(let i=0;i<attr.count;i++){
      const wave=.5+.5*Math.sin(t*speeds[i]+phases[i]);
      avgWave+=wave;

      // Make the individual sparkle visibly pulse warm-white.
      const brightness=.28+1.35*Math.pow(wave,1.7);
      attr.setXYZ(
        i,
        Math.min(1,baseColor.r*brightness),
        Math.min(1,baseColor.g*brightness),
        Math.min(1,baseColor.b*brightness)
      );
    }
    avgWave/=Math.max(1,attr.count);
    attr.needsUpdate=true;

    // Every star cluster breathes at a different tempo as well.
    const layerWave=.5+.5*Math.sin(t*(.38+layerIndex*.073)+layerIndex*1.37);
    layer.material.opacity=nightOpacity*(.50+.50*layerWave);
    const baseSize=layer.userData.basePointSize||(layer.userData.basePointSize=layer.material.size);
    layer.material.size=baseSize*(.82+.48*Math.pow(layerWave,2));
  }
}

const debugParams=new URLSearchParams(location.search);
const FORCE_NIGHT=debugParams.get('night')==='1';

function computeNightFactor(){
  if(FORCE_NIGHT)return 1;
  const d=new Date();
  const h=d.getHours()+d.getMinutes()/60;
  if(h>=20 || h<5)return 1;
  if(h>=17.5 && h<20)return THREE.MathUtils.smoothstep((h-17.5)/2.5,0,1);
  if(h>=5 && h<7)return 1-THREE.MathUtils.smoothstep((h-5)/2,0,1);
  return 0;
}

const nightWindowMeshes=[];
const flowerNightLights=[];

function cloneAsNightCapableMaterial(mat,nameSuffix=' Night'){
  if(!mat)return null;
  let m;
  if('emissive' in mat){
    m=mat.clone();
  }else{
    m=new THREE.MeshStandardMaterial({
      name:(mat.name||'Material')+nameSuffix,
      color:mat.color?.clone?.()||new THREE.Color(0xffffff),
      map:mat.map||null,
      transparent:!!mat.transparent,
      opacity:Number.isFinite(mat.opacity)?mat.opacity:1,
      side:mat.side??THREE.FrontSide,
      roughness:.45,
      metalness:0
    });
  }
  m.userData={...mat.userData};
  m.userData.nightBaseColor=m.color?.clone?.()||new THREE.Color(0xffffff);
  m.userData.nightBaseEmissive=m.emissive?.clone?.()||new THREE.Color(0x000000);
  m.userData.nightBaseIntensity=Number(m.emissiveIntensity)||0;
  return m;
}

function registerNightWindows(root){
  nightWindowMeshes.length=0;
  if(!root)return;
  root.updateMatrixWorld(true);

  root.traverse(o=>{
    if(!o.isMesh || !o.material)return;
    const n=normalizedAssetName(o.name);
    if(!(n.includes('ext house') && n.includes('window')))return;

    const source=Array.isArray(o.material)?o.material:[o.material];
    o.userData.atelierDayMaterials=source.map(mat=>mat?.clone?.()||mat);
    o.userData.atelierNightMaterials=source.map((mat,index)=>new THREE.MeshBasicMaterial({
      name:(mat?.name||('Window '+index))+' Lit',
      color:0xffd58f,
      transparent:false,
      opacity:1,
      side:mat?.side??THREE.FrontSide,
      toneMapped:false
    }));
    nightWindowMeshes.push(o);
  });

    console.log('Registered night windows:',nightWindowMeshes.length,nightWindowMeshes.map(o=>o.name));
}

const warmGlowTexture=makeWarmGlowTexture();

function collectNamedRoots(root,predicate){
  const found=[];
  if(!root)return found;
  root.traverse(o=>{
    if(o===root || !predicate(o))return;
    let p=o.parent;
    while(p && p!==root){
      if(predicate(p))return;
      p=p.parent;
    }
    found.push(o);
  });
  return found;
}

function registerFlowerNightLights(lightRoot,flowerRoot){
  for(const item of flowerNightLights){
    if(item.light)scene.remove(item.light);
    if(item.halo)scene.remove(item.halo);
  }
  flowerNightLights.length=0;

  let anchors=collectNamedRoots(lightRoot,o=>normalizedAssetName(o.name).startsWith('flower light'));

  // Fallback to actual lower-flower positions if the dedicated light GLB exported lights/empties
  // without preserving the expected named mesh.
  if(!anchors.length){
    anchors=collectNamedRoots(flowerRoot,o=>normalizedAssetName(o.name).includes('lower flower'));
  }

  for(const anchor of anchors.slice(0,16)){
    anchor.updateMatrixWorld(true);
    const pos=anchor.getWorldPosition(new THREE.Vector3());

    // If the anchor contains visible meshes, make those meshes emissive too.
    anchor.traverse?.(o=>{
      if(!o.isMesh || !o.material)return;
      const mats=(Array.isArray(o.material)?o.material:[o.material]).map(mat=>cloneAsNightCapableMaterial(mat,' FlowerNight'));
      o.material=Array.isArray(o.material)?mats:mats[0];
      o.userData.atelierFlowerLightMesh=true;
    });

    const light=new THREE.PointLight(0xffca72,0,3.8,2.0);
    light.position.copy(pos);
    light.position.y+=.08;
    light.castShadow=false;
    scene.add(light);

    const haloMat=new THREE.SpriteMaterial({
      map:warmGlowTexture,
      color:0xffd889,
      transparent:true,
      opacity:0,
      depthWrite:false,
      depthTest:false,
      blending:THREE.AdditiveBlending
    });
    const halo=new THREE.Sprite(haloMat);
    halo.name='Flower Night Halo';
    halo.position.copy(pos);
    halo.scale.set(1.25,1.25,1);
    halo.renderOrder=80;
    scene.add(halo);

    flowerNightLights.push({anchor,light,halo});
  }

    console.log('Registered flower night lights:',flowerNightLights.length,anchors.map(o=>o.name));
}

function updateRegisteredNightLights(factor){
  const windowOn=factor>.18;

  for(const mesh of nightWindowMeshes){
    const mats=windowOn?mesh.userData.atelierNightMaterials:mesh.userData.atelierDayMaterials;
    if(mats?.length)mesh.material=Array.isArray(mesh.material)?mats:mats[0];
  }

  for(const item of flowerNightLights){
    item.light.intensity=4.2*factor;
    item.halo.material.opacity=.92*factor;
    const scale=THREE.MathUtils.lerp(.9,1.65,factor);
    item.halo.scale.set(scale,scale,1);
  }
}

function updateDayNightLighting(force=false){
  const now=performance.now();
  if(!force && now-lastNightLightingUpdate<1000)return;
  lastNightLightingUpdate=now;

  nightFactor=computeNightFactor();
  scene.background=DAY_SKY.clone().lerp(NIGHT_SKY,nightFactor);
  hemi.intensity=THREE.MathUtils.lerp(1.08,.23,nightFactor);
  sun.intensity=THREE.MathUtils.lerp(1.72,.12,nightFactor);
  fill.intensity=THREE.MathUtils.lerp(.35,.15,nightFactor);
  scene.environmentIntensity=THREE.MathUtils.lerp(.38,.12,nightFactor);
  starField.visible=nightFactor>.06;

  const dayCloud=new THREE.Color(0xffffff);
  const nightCloud=new THREE.Color(0xaab6c8);
  for(const cloud of skyClouds){
    cloud.traverse(o=>{
      if(!o.isSprite || !o.material)return;
      o.material.color.copy(dayCloud).lerp(nightCloud,nightFactor);
      o.material.opacity=THREE.MathUtils.lerp(.98,.14,nightFactor);
    });
  }
  for(const reflection of waterCloudReflections){
    reflection.material.opacity=THREE.MathUtils.lerp(.58,.22,nightFactor);
    reflection.material.color.set(0xd5edf4).lerp(new THREE.Color(0x718092),nightFactor);
  }

  updateRegisteredNightLights(nightFactor);
}
updateDayNightLighting(true);

const loader=new GLTFLoader();
const dracoLoader=new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);
const clock=new THREE.Clock();

const clientId=getOrCreateClientId();
let ownerId=clientId;
let currentUser=null;
let artworkSaveQueue=Promise.resolve();
let progressSlides=[];
let progressSlideIndex=0;
let previewWorkId=null;
let displayName=getOrCreateDisplayName(clientId,IS_KO);
const remoteAvatars=new Map();
let realtimeChannel=null;
let heartbeatTimer=null;
let presencePulseTimer=null;
let presencePollTimer=null;
let lastMotionSentAt=0;
const remoteMotion=new Map();

let avatarRoot=null;
let avatarModel=null;
let avatarMixer=null;
const avatarActions={};
let currentAction=null;
let moveTarget=null;
let pendingPlayerSeat=null;
let playerSeat=null;
let mySeat=null;
let playerArtworkSeat=null;
let workElapsedSeconds=0;
let totalWorkElapsedSeconds=0;
let currentWorkElapsedSeconds=0;
let workSaveAccumulator=0;
let dailyWorkSyncAccumulator=0;
const STORAGE_KEY='atelier3d_progress_v1';
const TIMER_DATA_VERSION=3;
let savedArtworkDataUrl=null;
let savedArtworkSeatIndex=null;
let savedArtworkLockedUntil=0;
let activeWorkId=null;
let activeWorkCoverUrl=null;
let blockedPromptSeat=null;
let blockedPromptUntil=0;
const WORK_PROMPTS=['작업 중...','오늘 작업한 그림을 올려볼까요?'];
let furnitureScene=null;

// NPC atelier residents.
const npcs=[];
const seatSlots=[];
const NPC_COUNT=0;
const NPC_MIN_DISTANCE=0.78;
const NPC_HAT_COLORS=[
  0xd84f5f, // red
  0xf28b30, // orange
  0xe3bf2f, // mustard
  0x4f9b57, // green
  0x2f9c95, // teal
  0x3677b8, // blue
  0x5454a8, // indigo
  0x8454b3, // violet
  0xb34e8c, // magenta
  0x7c5337  // brown
];

const hatColorPool=[...NPC_HAT_COLORS];

function hatColorForSeatIndex(index){
  return hatColorPool[((index%hatColorPool.length)+hatColorPool.length)%hatColorPool.length];
}

function standingHatColorForClient(id){
  const index=Math.abs(hashString(id))%hatColorPool.length;
  return new THREE.Color(hatColorPool[index]);
}

function liveStandingColorForClient(id){
  const ids=[clientId,...remoteAvatars.keys()].filter(Boolean).sort();
  const index=Math.max(0,ids.indexOf(id));
  return new THREE.Color(hatColorPool[index%hatColorPool.length]);
}

function standingPlayerHatColor(){
  return liveStandingColorForClient(clientId);
}

function refreshStandingAvatarColors(){
  if(avatarModel && !playerSeat && !pendingPlayerSeat){
    recolorBeret(avatarModel,liveStandingColorForClient(clientId));
  }
  for(const [id,entry] of remoteAvatars){
    if(Number.isFinite(entry.seatIndex))continue;
    recolorBeret(entry.model,liveStandingColorForClient(id));
  }
}

let envMixer=null;
let boatMixer=null;
let extEnvMixer=null;

let snowSystem=null;
let snowPositions=null;
let snowVelocities=null;
let snowEnabled=true;

// Pavilion controller constants.
const WALK_RADIUS=8.05;
const CAMERA_RADIUS=8.95;
const BRIDGE_HALF_WIDTH=1.15;
const BRIDGE_ANGLE=THREE.MathUtils.degToRad(18);
const BRIDGE_OFFSET_X=-1.03;
const BRIDGE_OFFSET_Z=0.15;
const BRIDGE_START_Z=6.9;
const BRIDGE_END_Z=15.8;
const GALLERY_CENTER_Z=18.4;
const GALLERY_HALF_WIDTH=5.2;
const GALLERY_HALF_DEPTH=3.7;
const MOVE_SPEED=1.85;
const CENTER_BLOCK_RADIUS=1.90;
const MODEL_YAW_CORRECTION=-THREE.MathUtils.degToRad(97.005); // Blender/glTF front correction. Keep in one place.
const SIT_YAW_CORRECTION=0; // Seat faceDir already points from stool to easel; no extra quarter-turn.

// Camera orbit state. Completely independent from character facing.
let camYaw=0;
let camPitch=.12;
let camDistance=6.35;
let camTarget=new THREE.Vector3(0,1.45,-1.8);
let cameraFocus=new THREE.Vector3(0,1.45,-1.8);

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);

let pointerDown=false;
let dragged=false;
let downX=0,downY=0;
let lastX=0,lastY=0;

const keys=new Set();

function loadGLB(url){
  return new Promise((resolve,reject)=>loader.load(url,resolve,undefined,error=>{
    console.error('[ATELIER] Failed to load model:',url,error);
    reject(error);
  }));
}
function loadOptionalGLB(url){
  return loadGLB(url).catch(error=>{
    console.warn('[ATELIER] Optional model unavailable:',url,error);
    return null;
  });
}

const atelierWaterNormal=makeWaterNormalTexture();
const lanternLights=[];

function addLanternGlow(root){
  let added=0;
  root.updateMatrixWorld(true);

  root.traverse(o=>{
    if(added>=14 || !o.isMesh)return;
    const n=(o.name||'').toLowerCase();
    const mn=Array.isArray(o.material)
      ? o.material.map(m=>(m?.name||'').toLowerCase()).join(' ')
      : (o.material?.name||'').toLowerCase();

    if(!(n.includes('lantern')||n.includes('lamp')||mn.includes('lantern')||mn.includes('lamp')))return;

    const pos=o.getWorldPosition(new THREE.Vector3());

    // Avoid creating several lights for parts of the same lantern.
    if(lanternLights.some(l=>l.position.distanceTo(pos)<0.55))return;

    const light=new THREE.PointLight(0xffc982,2.25,5.4,2.0);
    light.position.copy(pos);
    light.position.y+=0.12;
    light.castShadow=false;
    scene.add(light);
    lanternLights.push(light);
    added++;
  });
}

function hasNamedAncestor(o,token){
  let cur=o;
  const t=token.toLowerCase();
  while(cur){
    if((cur.name||'').toLowerCase().includes(t))return true;
    cur=cur.parent;
  }
  return false;
}

const animatedWaterMaterials=[];

function enhanceMaterials(root){
  root.traverse(o=>{
    if(!o.isMesh)return;

    const objectName=(o.name||'').toLowerCase();
    const mats=Array.isArray(o.material)?o.material:[o.material];

    o.castShadow=true;
    o.receiveShadow=true;

    mats.filter(Boolean).forEach((mat,index)=>{
      const materialName=(mat.name||'').toLowerCase();

      // Exact classifications from the exported GLB.
      const isGlass =
        materialName==='glass' ||
        objectName==='glass dome';

      const isWater =
        materialName==='ext water' ||
        objectName==='ext water surface' ||
        materialName.includes('water') ||
        objectName.includes('water');

      const isFoliage =
        objectName.includes('leaf') ||
        objectName.includes('leaves') ||
        objectName.includes('foliage') ||
        objectName.includes('branch') ||
        objectName.includes('tree') ||
        materialName.includes('leaf') ||
        materialName.includes('leaves') ||
        materialName.includes('foliage') ||
        materialName.includes('tree');

      const isLantern =
        objectName.includes('lantern') ||
        objectName.includes('lamp') ||
        materialName.includes('lantern') ||
        materialName.includes('lamp');

      const isEaselPart=hasNamedAncestor(o,'easel');
      const isActualCanvas=
        objectName.includes('canvas') ||
        objectName.includes('painting') ||
        objectName.includes('artwork');

      const isCanvas =
        isActualCanvas ||
        (materialName==='canvas' && !isEaselPart);

      const isStructureWood =
        (
          materialName==='warm oak' ||
          materialName==='dark oak' ||
          materialName==='ext dark wood' ||
          objectName.startsWith('column ') ||
          objectName.startsWith('roof beam ') ||
          objectName.includes('rear support') ||
          isEaselPart
        ) && !isActualCanvas;

      // GLASS: subtle clear greenhouse glass, not a foggy overlay.
      if(isGlass){
        const glass=new THREE.MeshPhysicalMaterial({
          name:'Atelier Clear Glass',
          color:new THREE.Color('#f4fbff'),
          transparent:true,
          opacity:0.10,
          transmission:0.22,
          roughness:0.07,
          metalness:0,
          ior:1.45,
          thickness:0.08,
          clearcoat:1,
          clearcoatRoughness:0.05,
          envMapIntensity:0.85,
          side:THREE.DoubleSide,
          depthWrite:false,
          depthTest:true
        });

        if(Array.isArray(o.material)){
          o.material[index]=glass;
        }else{
          o.material=glass;
        }

        o.castShadow=false;
        o.receiveShadow=false;
        return;
      }

      // WATER: richer reflective water with animated procedural ripples.
      if(isWater){
        const water=new THREE.MeshPhysicalMaterial({
          name:'Atelier Water',
          color:new THREE.Color('#4f9eb4'),
          transparent:true,
          opacity:0.98,
          roughness:0.06,
          metalness:0.03,
          transmission:0.02,
          ior:1.333,
          thickness:0.12,
          clearcoat:1,
          clearcoatRoughness:0.035,
          envMapIntensity:2.4,
          normalMap:atelierWaterNormal.clone(),
          normalScale:new THREE.Vector2(1.30,1.15),
          side:THREE.DoubleSide,
          depthWrite:true,
          depthTest:true
        });
        water.normalMap.wrapS=water.normalMap.wrapT=THREE.RepeatWrapping;
        water.normalMap.repeat.set(2.8,2.8);

        if(Array.isArray(o.material)){
          o.material[index]=water;
        }else{
          o.material=water;
        }

        o.userData.waterMaterial=water;
        animatedWaterMaterials.push(water);
        o.castShadow=false;
        o.receiveShadow=true;
        return;
      }

      // FOLIAGE: stronger depth/readability without plastic shine.
      if(isFoliage){
        mat.transparent=!!mat.map && mat.transparent;
        mat.side=THREE.DoubleSide;
        mat.depthWrite=true;
        mat.alphaTest=mat.transparent?Math.max(mat.alphaTest||0,0.12):0;

        if('roughness' in mat)mat.roughness=0.92;
        if('metalness' in mat)mat.metalness=0;
        if('envMapIntensity' in mat)mat.envMapIntensity=0.18;

        if(mat.color){
          // Small deterministic variation between tree meshes.
          let h=0;
          for(let k=0;k<objectName.length;k++)h=(h*31+objectName.charCodeAt(k))>>>0;
          const variation=((h%9)-4)/100;
          const hsl={h:0,s:0,l:0};
          mat.color.getHSL(hsl);
          mat.color.setHSL(
            hsl.h,
            THREE.MathUtils.clamp(hsl.s*1.08,0,1),
            THREE.MathUtils.clamp(hsl.l+variation,0.05,0.95)
          );
        }

        o.castShadow=true;
        o.receiveShadow=true;
        mat.needsUpdate=true;
        return;
      }

      // LANTERNS: warm emissive housing; actual light is added after load.
      if(isLantern){
        if(mat.emissive){
          mat.emissive.set('#ffd29a');
          mat.emissiveIntensity=2.4;
        }
        if('roughness' in mat)mat.roughness=0.34;
        if('envMapIntensity' in mat)mat.envMapIntensity=0.6;
        mat.needsUpdate=true;
      }

      // CANVAS: fully opaque white board.
      if(isCanvas){
        mat.transparent=false;
        mat.opacity=1;
        mat.depthWrite=true;
        mat.depthTest=true;
        mat.alphaTest=0;
        mat.side=THREE.FrontSide;

        if('color' in mat)mat.color.set('#f7f4ec');
        if('roughness' in mat)mat.roughness=0.96;
        if('metalness' in mat)mat.metalness=0;

        mat.polygonOffset=true;
        mat.polygonOffsetFactor=-2;
        mat.polygonOffsetUnits=-2;

        o.receiveShadow=false;
        o.renderOrder=5;
        mat.needsUpdate=true;
        return;
      }

      // STRUCTURAL WOOD: columns, beams, easels must never be transparent.
      if(isStructureWood){
        mat.transparent=false;
        mat.opacity=1;
        mat.depthWrite=true;
        mat.side=THREE.FrontSide;

        if(mat.color)mat.color.set('#b98252');
        if('transmission' in mat)mat.transmission=0;
        if('roughness' in mat)mat.roughness=0.58;
        if('metalness' in mat)mat.metalness=0;
        if('envMapIntensity' in mat)mat.envMapIntensity=0.32;

        o.castShadow=true;
        o.receiveShadow=true;
        mat.needsUpdate=true;
        return;
      }

      if('envMapIntensity' in mat){
        mat.envMapIntensity=Math.max(mat.envMapIntensity||0,0.25);
      }
    });
  });
}

function playAvatar(name,fade=.12){
  const next=avatarActions[name];
  if(!next)return;

  if(currentAction===next){
    if(!next.isRunning())next.reset().play();
    return;
  }

  next.enabled=true;
  next.clampWhenFinished=false;
  next.setLoop(THREE.LoopRepeat,Infinity);
  next.reset().play();

  if(currentAction)currentAction.crossFadeTo(next,fade,false);
  currentAction=next;
}

function setAvatarFacing(dir){
  avatarRoot.rotation.y=facingYaw(dir,MODEL_YAW_CORRECTION);
}

const WALKABLE_GEOMETRY={
  walkRadius:WALK_RADIUS,
  bridgeHalfWidth:BRIDGE_HALF_WIDTH,
  bridgeAngle:BRIDGE_ANGLE,
  bridgeOffsetX:BRIDGE_OFFSET_X,
  bridgeOffsetZ:BRIDGE_OFFSET_Z,
  bridgeStartZ:BRIDGE_START_Z,
  bridgeEndZ:BRIDGE_END_Z,
  galleryCenterZ:GALLERY_CENTER_Z,
  galleryHalfWidth:GALLERY_HALF_WIDTH,
  galleryHalfDepth:GALLERY_HALF_DEPTH
};

function constrainWalkable(next,previous){
  return constrainWalkableByConfig(next,previous,WALKABLE_GEOMETRY);
}

function logEaselClampDiagnostics(root){
  if(!root)return;
  const rows=[];
  root.traverse(o=>{
    if(!o.isMesh || !o.material)return;
    const on=normalizedAssetName(o.name);
    if(!(on.includes('easel') && on.includes('clamp')))return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    rows.push({
      object:o.name||'',
      normalized:on,
      materials:mats.map(m=>m?.name||''),
      colors:mats.map(m=>m?.color?('#'+m.color.getHexString()):'')
    });
  });
  console.table(rows);
  window.__easelClampDiagnostics=rows;
}

function repairFurnitureExport(root){
  if(!root)return;

  // Blender export currently contains 10 stool transform groups,
  // but mesh children only under one source group. Clone that stool
  // geometry into the remaining empty transform groups.
  const stoolGroups=[];
  root.children.forEach(o=>{
    if(normalizedAssetName(o.name).startsWith('stool group 01'))stoolGroups.push(o);
  });

  const source=stoolGroups.find(g=>{
    let hasMesh=false;
    g.traverse(o=>{if(o.isMesh)hasMesh=true;});
    return hasMesh;
  });

  if(source){
    for(const target of stoolGroups){
      if(target===source)continue;
      let hasMesh=false;
      target.traverse(o=>{if(o.isMesh)hasMesh=true;});
      if(hasMesh)continue;

      for(const child of source.children){
        const clone=child.clone(true);
        clone.name=(child.name||'Stool Part')+'__clone_'+target.name;
        clone.traverse(o=>{
          if(o.isMesh && o.material){
            if(Array.isArray(o.material))o.material=o.material.map(m=>m?.clone?.()||m);
            else o.material=o.material.clone?.()||o.material;
          }
        });
        target.add(clone);
      }
    }
  }

  root.updateMatrixWorld(true);
}

function forceNamedClampMaterials(root){
  if(!root)return;
  root.traverse(o=>{
    if(!o.isMesh)return;
    const n=normalizedAssetName(o.name);
    if(!/^easel\s+\d+\s+clamp(?:\s+\d+)?$/.test(n))return;

    const mat=new THREE.MeshStandardMaterial({
      name:'Atelier Dark Oak Clamp',
      color:new THREE.Color('#4f2b1b'),
      roughness:.62,
      metalness:0,
      transparent:false,
      opacity:1,
      depthWrite:true,
      side:THREE.FrontSide
    });
    o.material=mat;
    o.castShadow=true;
    o.receiveShadow=true;
    o.userData.atelierClampFixed=true;
  });
}

function forceEaselWoodMaterials(root){
  if(!root)return;

  root.traverse(mesh=>{
    if(!mesh.isMesh || !mesh.material)return;

    const objectName=normalizedAssetName(mesh.name);
    const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];

    const fixed=source.map(mat=>{
      if(!mat)return mat;
      const materialName=normalizedAssetName(mat.name);

      const isNamedEaselClamp=/^easel\s+\d+\s+clamp(?:\s+\d+)?$/.test(objectName);

      const forceWood=
        materialName==='dark oak' ||
        materialName==='warm oak' ||
        isNamedEaselClamp ||
        objectName.includes('clip') ||
        objectName.includes('holder') ||
        objectName.includes('support') ||
        objectName.includes('easel');

      const isActualCanvas=
        objectName.includes('canvas') ||
        objectName.includes('painting') ||
        objectName.includes('artwork') ||
        (materialName.includes('canvas') && !forceWood);

      if(isActualCanvas)return mat;
      if(!forceWood)return mat;

      const m=mat.clone();
      if(m.color)m.color.set('#6f4228');
      if('roughness' in m)m.roughness=.58;
      if('metalness' in m)m.metalness=0;
      if('transmission' in m)m.transmission=0;
      m.transparent=false;
      m.opacity=1;
      m.depthWrite=true;
      m.needsUpdate=true;
      return m;
    });

    mesh.material=Array.isArray(mesh.material)?fixed:fixed[0];
  });
}
function forceEaselTopClampsByGeometry(root){
  if(!root)return;

  const easels=collectNamedRoots(root,o=>/^easel\s+\d+$/.test(normalizedAssetName(o.name)));
  for(const easel of easels){
    easel.updateMatrixWorld(true);

    const meshes=[];
    easel.traverse(o=>{ if(o.isMesh && o.material)meshes.push(o); });
    if(!meshes.length)continue;

    const canvasCandidates=meshes.filter(o=>{
      const on=normalizedAssetName(o.name);
      const mats=Array.isArray(o.material)?o.material:[o.material];
      return on.includes('canvas') || mats.some(m=>normalizedAssetName(m?.name).includes('canvas'));
    });
    if(!canvasCandidates.length)continue;

    canvasCandidates.sort((a,b)=>{
      const sa=new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3());
      const sb=new THREE.Box3().setFromObject(b).getSize(new THREE.Vector3());
      return (sb.x*sb.y+sb.x*sb.z+sb.y*sb.z)-(sa.x*sa.y+sa.x*sa.z+sa.y*sa.z);
    });
    const canvas=canvasCandidates[0];
    const cbox=new THREE.Box3().setFromObject(canvas);
    const ccenter=cbox.getCenter(new THREE.Vector3());
    const csize=cbox.getSize(new THREE.Vector3());

    for(const mesh of meshes){
      if(mesh===canvas)continue;
      const box=new THREE.Box3().setFromObject(mesh);
      const center=box.getCenter(new THREE.Vector3());
      const size=box.getSize(new THREE.Vector3());

      const isAboveCanvas=
        center.y > cbox.max.y - csize.y*.08 &&
        center.y < cbox.max.y + csize.y*.28;
      const horizontallyAligned=
        Math.abs(center.x-ccenter.x) < Math.max(csize.x,csize.z)*.42 &&
        Math.abs(center.z-ccenter.z) < Math.max(csize.x,csize.z)*.42;
      const isSmall=
        Math.max(size.x,size.y,size.z) < Math.max(csize.x,csize.y,csize.z)*.30;

      if(!(isAboveCanvas && horizontallyAligned && isSmall))continue;

      const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const fixed=source.map(mat=>{
        if(!mat)return mat;
        const m=mat.clone();
        if(m.color)m.color.set('#6f4228');
        if('roughness' in m)m.roughness=.58;
        if('metalness' in m)m.metalness=0;
        if('transmission' in m)m.transmission=0;
        m.transparent=false;
        m.opacity=1;
        m.depthWrite=true;
        m.needsUpdate=true;
        return m;
      });
      mesh.material=Array.isArray(mesh.material)?fixed:fixed[0];
      mesh.userData.atelierClampFixed=true;
    }
  }
}

function keepOnlyFurniture(root){
  root.traverse(o=>{
    if(o===root)return;
    const n=(o.name||'').toLowerCase();
    const keep=
      n.includes('easel') ||
      n.includes('stool') ||
      n.includes('canvas') ||
      hasNamedAncestor(o,'easel') ||
      hasNamedAncestor(o,'stool');

    if(o.isMesh)o.visible=!!keep;
  });
}

function keepOnlyFlowers(root){
  // Show the dedicated flower GLB and restore the intended Lower Flower tilt.
  // Blender's -90° lower-flower orientation is not surviving the glTF/web axis conversion reliably.
  root.traverse(o=>{
    o.visible=true;
    if(o.isMesh)o.frustumCulled=false;
  });

  // Rotate only top-level Lower Flower roots so children are not rotated twice.
  const lowerRoots=[];
  root.traverse(o=>{
    if(o===root)return;
    const n=(o.name||'').toLowerCase();
    if(!n.includes('lower flower'))return;

    let p=o.parent;
    while(p && p!==root){
      if((p.name||'').toLowerCase().includes('lower flower'))return;
      p=p.parent;
    }
    lowerRoots.push(o);
  });

  lowerRoots.forEach(o=>{
    o.rotation.x=-Math.PI/2;
  });

  root.updateMatrixWorld(true);
}

function keepFurnitureInsidePavilion(furnitureRoot){
  const roots=[];

  furnitureRoot.traverse(o=>{
    const n=(o.name||'').toLowerCase();
    const normalized=normalizedAssetName(o.name);
    const isCandidate=/^easel\s+\d+$/.test(normalized) || n.includes('stool_group') || n.startsWith('stool');
    if(!isCandidate)return;

    let p=o.parent;
    while(p && p!==furnitureRoot){
      const pn=(p.name||'').toLowerCase();
      const pNormalized=normalizedAssetName(p.name);
      if(/^easel\s+\d+$/.test(pNormalized) || pn.includes('stool_group') || pn.startsWith('stool'))return;
      p=p.parent;
    }
    roots.push(o);
  });

  roots.forEach(root=>{
    const box=new THREE.Box3().setFromObject(root);
    if(box.isEmpty())return;
    const center=box.getCenter(new THREE.Vector3());
    const r=Math.hypot(center.x,center.z);
    const maxR=7.55;

    if(r>maxR){
      const target=center.clone().multiplyScalar(maxR/r);
      const delta=new THREE.Vector3(target.x-center.x,0,target.z-center.z);
      root.position.add(delta);
      root.updateMatrixWorld(true);
    }
  });
}

function collectSeatSlots(furnitureRoot){
  seatSlots.length=0;

  const stoolRoots=[];
  const easels=[];

  furnitureRoot.traverse(o=>{
    const n=(o.name||'').toLowerCase();

    if(n.includes('stool_group') || n.startsWith('stool')){
      let p=o.parent;
      while(p && p!==furnitureRoot){
        const pn=(p.name||'').toLowerCase();
        if(pn.includes('stool_group') || pn.startsWith('stool'))return;
        p=p.parent;
      }
      stoolRoots.push(o);
      return;
    }

    const normalized=normalizedAssetName(o.name);
    const isEaselRoot=/^easel\s+\d+$/.test(normalized);

    if(isEaselRoot){
      let p=o.parent;
      while(p && p!==furnitureRoot){
        const pn=normalizedAssetName(p.name);
        if(/^easel\s+\d+$/.test(pn))return;
        p=p.parent;
      }

      const box=new THREE.Box3().setFromObject(o);
      if(!box.isEmpty()){
        easels.push({
          o,
          center:box.getCenter(new THREE.Vector3())
        });
      }
    }
  });

  // Match each stool to the closest easel, then place the stool consistently
  // on the pavilion-center side of that easel.
  console.log('Seat easel roots:',easels.map(e=>e.o.name));
  const unused=[...easels];

  stoolRoots.forEach((stool,index)=>{
    const stoolBox=new THREE.Box3().setFromObject(stool);
    if(stoolBox.isEmpty())return;
    const stoolCenter=stoolBox.getCenter(new THREE.Vector3());

    let nearestIndex=-1;
    let nearestD=Infinity;
    unused.forEach((e,i)=>{
      const d=(e.center.x-stoolCenter.x)**2+(e.center.z-stoolCenter.z)**2;
      if(d<nearestD){nearestD=d;nearestIndex=i;}
    });

    if(nearestIndex<0)return;
    const easel=unused.splice(nearestIndex,1)[0];

    // From easel toward pavilion center = where the sitter should be.
    const inward=new THREE.Vector3(-easel.center.x,0,-easel.center.z);
    if(inward.lengthSq()<0.0001)inward.set(0,0,1);
    inward.normalize();

    // Desired stool center is ~0.95 m inward from the easel.
    const desiredCenter=easel.center.clone().addScaledVector(inward,0.95);
    const delta=new THREE.Vector3(
      desiredCenter.x-stoolCenter.x,
      0,
      desiredCenter.z-stoolCenter.z
    );
    stool.position.add(delta);
    stool.updateMatrixWorld(true);

    // Recompute final stool center after moving it.
    const finalBox=new THREE.Box3().setFromObject(stool);
    const finalCenter=finalBox.getCenter(new THREE.Vector3());

    const faceDir=new THREE.Vector3(
      easel.center.x-finalCenter.x,
      0,
      easel.center.z-finalCenter.z
    ).normalize();

    const floorY=avatarRoot?.position.y ?? 0;
    const seat={
      index,
      stool,
      easel:easel.o,
      easelCenter:easel.center.clone(),
      position:new THREE.Vector3(finalCenter.x,floorY,finalCenter.z),
      seatTop:finalBox.max.y,
      faceDir,
      occupiedBy:null,
      artworkLockedUntil:0,
      serverOccupant:null,
      serverArtworkOwner:null,
      clickRadius:0.95
    };

    stool.traverse(child=>{child.userData.seatSlot=seat;});
    stool.userData.seatSlot=seat;
    easel.o.traverse(child=>{child.userData.seatSlot=seat;});
    easel.o.userData.seatSlot=seat;
    seatSlots.push(seat);
  });

  seatSlots.sort((a,b)=>Math.atan2(a.position.x,a.position.z)-Math.atan2(b.position.x,b.position.z));
  console.log('Seat slots aligned to easels:',seatSlots.length);
}

function makeNPCActionSet(model,clips){
  const mixer=new THREE.AnimationMixer(model);
  const actions={};
  clips.forEach(clip=>actions[clip.name]=mixer.clipAction(clip));
  return {mixer,actions,current:null};
}

function playNPC(npc,name,fade=.14){
  const next=npc.actions[name];
  if(!next)return;

  if(npc.current===next){
    if(!next.isRunning())next.reset().play();
    return;
  }

  next.enabled=true;
  next.clampWhenFinished=false;
  next.setLoop(THREE.LoopRepeat,Infinity);
  next.reset().play();
  if(npc.current)npc.current.crossFadeTo(next,fade,false);
  npc.current=next;
}

function isInsideCenterBlock(pos,margin=0){
  return Math.hypot(pos.x,pos.z)<(CENTER_BLOCK_RADIUS+margin);
}

function randomWalkTarget(exceptNPC=null){
  for(let tries=0;tries<50;tries++){
    const radius=THREE.MathUtils.lerp(3.15,7.25,Math.sqrt(Math.random()));
    const a=Math.random()*Math.PI*2;
    const p=new THREE.Vector3(Math.sin(a)*radius,0,Math.cos(a)*radius);

    let blocked=isInsideCenterBlock(p,.35);
    for(const n of npcs){
      if(n===exceptNPC)continue;
      if(n.root.position.distanceTo(p)<1.25){blocked=true;break;}
    }
    if(!blocked&&avatarRoot&&avatarRoot.position.distanceTo(p)<1.1)blocked=true;
    if(!blocked)return p;
  }
  return new THREE.Vector3(3.6,0,0);
}

function releaseSeat(npc){
  if(npc.seat){
    if(npc.seat.occupiedBy===npc)npc.seat.occupiedBy=null;
    npc.seat=null;
  }
}

function reserveRandomSeat(npc){
  const free=seatSlots.filter(s=>!s.occupiedBy && !s.serverOccupant && !isArtworkLocked(s));
  if(!free.length)return false;
  const seat=free[Math.floor(Math.random()*free.length)];
  seat.occupiedBy=npc;
  npc.seat=seat;
  npc.target=seat.position.clone();
  npc.state='goingToSeat';
  playNPC(npc,'Avatar_Walk');
  return true;
}

function placeNPCSeated(npc,seat){
  seat.occupiedBy=npc;
  npc.seat=seat;
  npc.root.position.copy(seat.position);
  npc.root.rotation.y=Math.atan2(seat.faceDir.x,seat.faceDir.z)+MODEL_YAW_CORRECTION+SIT_YAW_CORRECTION;
  npc.state='seated';
  npc.stateUntil=performance.now()/1000+THREE.MathUtils.randFloat(7,15);
  playNPC(npc,npc.actions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit',0);
}

function spawnNPCs(baseModel,clips,count=NPC_COUNT){
  npcs.splice(0,npcs.length);

  for(let i=0;i<count;i++){
    const root=new THREE.Group();
    const model=SkeletonUtils.clone(baseModel);
    isolateAvatarMaterials(model);
    root.add(model);

    const {mixer,actions,current}=makeNPCActionSet(model,clips);
    const npc={
      id:i,
      root,
      model,
      mixer,
      actions,
      current,
      state:'idle',
      stateUntil:0,
      target:null,
      seat:null,
      speed:THREE.MathUtils.randFloat(1.0,1.45)
    };

    const color=hatColorPool[(hatColorPool.length-1-i+hatColorPool.length)%hatColorPool.length];
    npc.hatColor=color;
    recolorBeret(model,color);

    root.position.copy(randomWalkTarget(npc));
    scene.add(root);
    npcs.push(npc);
    playNPC(npc,'Avatar_Idle',0);
  }

  // Make the room immediately feel occupied: two residents begin seated,
  // the rest start at separated roaming locations.
  const freeSeats=seatSlots.filter(s=>!s.serverOccupant && !isArtworkLocked(s));
  for(let i=0;i<Math.min(2,npcs.length,freeSeats.length);i++){
    const idx=Math.floor(Math.random()*freeSeats.length);
    const seat=freeSeats.splice(idx,1)[0];
    placeNPCSeated(npcs[i],seat);
  }

  for(let i=2;i<npcs.length;i++){
    npcs[i].target=randomWalkTarget(npcs[i]);
    npcs[i].state='walking';
    playNPC(npcs[i],'Avatar_Walk',0);
  }
}

function npcCandidateBlocked(npc,candidate,minDistance=NPC_MIN_DISTANCE){
  if(isInsideCenterBlock(candidate,.20))return true;
  if(avatarRoot&&avatarRoot.position.distanceTo(candidate)<minDistance)return true;

  for(const other of npcs){
    if(other===npc)continue;
    if(other.root.position.distanceTo(candidate)<minDistance)return true;
  }
  return false;
}

function playerCandidateBlocked(candidate,minDistance=.64){
  const candidateR=Math.hypot(candidate.x,candidate.z);
  const currentR=avatarRoot?Math.hypot(avatarRoot.position.x,avatarRoot.position.z):Infinity;

  // Block entering the center table, but always allow escaping outward
  // if the player ever starts slightly inside the safety radius.
  if(isInsideCenterBlock(candidate,.16) && candidateR<=currentR)return true;

  return npcs.some(n=>n.root.position.distanceTo(candidate)<minDistance);
}

async function fetchServerState(){
  const {easels,artworks,presence,easelError,artworkError,presenceError}=await fetchWorldState(supabase);
  if(easelError)console.warn('easel sync',easelError);
  if(artworkError)console.warn('artwork sync',artworkError);
  if(presenceError)console.warn('presence sync',presenceError);
  if(easels)applyServerEasels(easels);
  if(artworks)applyServerArtworks(artworks);
  if(presence)applyPresenceRows(presence);
}

function applyServerEasels(rows){
  const byIndex=new Map(rows.map(r=>[r.seat_index,r]));
  for(const seat of seatSlots){
    const row=byIndex.get(seat.index);
    const heartbeatMs=row?.heartbeat_at?new Date(row.heartbeat_at).getTime():0;
    const fresh=row?.occupant_id && heartbeatMs && Date.now()-heartbeatMs<22000;
    seat.serverOccupant=fresh?row.occupant_id:null;

    // A real remote user always wins over a local decorative NPC.
    if(seat.serverOccupant && seat.serverOccupant!==clientId && seat.occupiedBy && seat.occupiedBy!=='player'){
      const npc=seat.occupiedBy;
      if(npc?.seat===seat)npc.seat=null;
      npc.target=randomWalkTarget(npc);
      npc.state='walking';
      playNPC(npc,'Avatar_Walk');
      seat.occupiedBy=null;
    }
  }
  syncRemoteAvatars();
}

function disposeRemoteAvatar(entry){
  if(!entry)return;
  scene.remove(entry.root);
  remoteAvatars.delete(entry.clientId);
}

function syncRemoteAvatars(){
  if(!avatarModel)return;
  const wanted=new Map();
  for(const seat of seatSlots){
    const id=seat.serverOccupant;
    if(id && id!==clientId)wanted.set(id,seat);
  }

  for(const [id,entry] of remoteAvatars){
    if(!wanted.has(id) && performance.now()-(entry.lastMotionAt||0)>2500)disposeRemoteAvatar(entry);
  }

  for(const [id,seat] of wanted){
    let entry=ensureRemoteAvatar(id,{seatIndex:seat.index});
    if(!entry)continue;
    recolorBeret(entry.model,hatColorForSeatIndex(seat.index));

    const motion=remoteMotion.get(id);
    if(!motion || motion.state==='working'){
      entry.targetPosition.copy(seat.position);
      entry.targetYaw=Math.atan2(seat.faceDir.x,seat.faceDir.z)+MODEL_YAW_CORRECTION+SIT_YAW_CORRECTION;
      entry.root.position.copy(seat.position);
      entry.root.rotation.y=entry.targetYaw;
      playRemote(entry,entry.actions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit');
    }
  }
}

function removeArtworkOverlayVisual(seat){
  const canvases=getCanvasMeshesForSeat(seat);
  canvases.forEach(mesh=>{
    const old=mesh.getObjectByName('Artwork Overlay');
    if(old){
      old.geometry?.dispose?.();
      old.material?.map?.dispose?.();
      old.material?.dispose?.();
      mesh.remove(old);
    }
  });
}

function applyServerArtworks(rows){
  const now=Date.now();
  const liveRows=(rows||[]).filter(row=>{
    const isLegacyInlineArtwork=
      !row?.work_id &&
      typeof row?.image_url==='string' &&
      row.image_url.startsWith('data:image/');
    if(isLegacyInlineArtwork){
      console.warn('Ignoring legacy inline artwork row',row.seat_index,row.display_name||'');
      return false;
    }

    const lockUntil=row?.locked_until?new Date(row.locked_until).getTime():0;
    const isExpiredExhibition=lockUntil && lockUntil<=now;
    if(isExpiredExhibition){
      console.warn('Ignoring expired easel artwork row',row.seat_index,row.display_name||'');
      return false;
    }
    return true;
  });
  const bySeat=new Map(liveRows.map(r=>[r.seat_index,r]));

  for(const seat of seatSlots){
    const row=bySeat.get(seat.index);
    const isLocalCurrentArtwork=
      seat===playerArtworkSeat ||
      (savedArtworkSeatIndex===seat.index && !!savedArtworkDataUrl);

    seat.artworkLockedUntil=row?.locked_until?new Date(row.locked_until).getTime():0;
    seat.userData=seat.userData||{};

    if(!row){
      if(!isLocalCurrentArtwork){
        removeArtworkOverlayVisual(seat);
        seat.serverArtworkOwner=null;
        delete seat.userData.artworkDataUrl;
        delete seat.userData.artworkMeta;
        delete seat.userData.workId;
      }
      continue;
    }

    const sameRemoteArtwork=
      row.owner_id!==ownerId &&
      seat.serverArtworkOwner===row.owner_id &&
      seat.userData.artworkDataUrl===row.image_url &&
      getCanvasMeshesForSeat(seat).some(mesh=>!!mesh.getObjectByName('Artwork Overlay'));

    seat.serverArtworkOwner=row.owner_id||null;

    // Always keep server artwork identity on the seat, including my own row.
    // This is required after a work is completed: the exhibition remains visible,
    // while activeWorkId is cleared, so clicking must still resolve the completed work.
    seat.userData.artworkMeta=(row.display_name||'Painter')+' · '+t('작업 ','work ')+Math.max(1,Math.round((row.work_seconds||0)/60))+t('분',' min');
    seat.userData.workId=row.work_id||null;
    if(row.image_url)seat.userData.artworkDataUrl=row.image_url;

    if(row.owner_id===ownerId)continue;

    // Keep an unchanged remote artwork on the canvas through seat claim/release refreshes.
    // This prevents a visitor who only sits down from making the displayed artwork vanish.
    if(sameRemoteArtwork){
      seat.userData.artworkDataUrl=row.image_url;
      continue;
    }

    removeArtworkOverlayVisual(seat);
    seat.userData.artworkDataUrl=row.image_url;

    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>getCanvasMeshesForSeat(seat).forEach(mesh=>makeArtworkOverlay(mesh,img,seat));
    img.onerror=()=>console.warn('remote artwork image failed',row.image_url);
    img.src=row.image_url;
  }
}

function makeNameLabel(text){
  const font='600 32px -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif';
  const measure=document.createElement('canvas').getContext('2d');
  measure.font=font;
  const textWidth=Math.ceil(measure.measureText(text).width);
  const w=Math.max(190,textWidth+48);
  const h=64;

  const c=document.createElement('canvas');
  c.width=w;
  c.height=h;
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,w,h);

  // Online-Sansa-like restrained floating tag: dark translucent pill, no heavy border.
  ctx.fillStyle='rgba(39,34,31,.72)';
  ctx.beginPath();
  ctx.roundRect(6,6,w-12,h-12,26);
  ctx.fill();

  ctx.fillStyle='rgba(255,255,255,.96)';
  ctx.font=font;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,w/2,h/2+1);

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;

  const mat=new THREE.SpriteMaterial({
    map:tex,
    transparent:true,
    depthTest:false,
    depthWrite:false,
    opacity:.95
  });

  const sprite=new THREE.Sprite(mat);
  sprite.name='Player Name Label';
  const worldH=.24;
  sprite.scale.set(worldH*(w/h),worldH,1);
  sprite.position.set(0,2.02,0);
  sprite.renderOrder=100;
  sprite.userData.labelText=text;
  return sprite;
}

function setAvatarNameLabel(root,text){
  if(!root || !text)return;
  const old=root.getObjectByName('Player Name Label');
  if(old?.userData?.labelText===text)return;
  if(old){
    old.material?.map?.dispose?.();
    old.material?.dispose?.();
    root.remove(old);
  }
  root.add(makeNameLabel(text));
}

function ensureRemoteAvatar(id,state={}){
  if(id===clientId || !avatarModel)return null;
  let entry=remoteAvatars.get(id);
  if(!entry){
    const root=new THREE.Group();
    root.userData.remoteClientId=id;
    const model=SkeletonUtils.clone(avatarModel);
    isolateAvatarMaterials(model);
    root.add(model);
    const mixer=new THREE.AnimationMixer(model);
    const actions={};
    window.__atelierAvatarClips?.forEach(clip=>actions[clip.name]=mixer.clipAction(clip));
    scene.add(root);
    entry={clientId:id,root,model,mixer,actions,current:null,targetPosition:new THREE.Vector3(),targetYaw:0,lastMotionAt:0,displayName:state.displayName||null,lastGreetingAt:0,seatIndex:null};
    setAvatarNameLabel(root,state.displayName||'이름 없는 화가');
    const initialLabel=root.getObjectByName('Player Name Label');
    if(initialLabel)initialLabel.visible=false;
    remoteAvatars.set(id,entry);
    refreshStandingAvatarColors();
  }
  entry.seatIndex=Number.isFinite(state.seatIndex)?state.seatIndex:null;
  if(Number.isFinite(entry.seatIndex)){
    recolorBeret(entry.model,hatColorForSeatIndex(entry.seatIndex));
  }else{
    refreshStandingAvatarColors();
  }
  if(state.displayName){
    entry.displayName=state.displayName;
    if((entry.greetingUntil||0)<=performance.now()){
      setAvatarNameLabel(entry.root,state.displayName);
    }
  }
  return entry;
}

function playRemote(entry,name){
  if(name!=='Avatar_Greet' && (entry?.greetingUntil||0)>performance.now())return;
  const next=entry?.actions?.[name];
  if(!next || entry.current===next)return;
  next.reset().play();
  if(entry.current)entry.current.crossFadeTo(next,.12,false);
  entry.current=next;
}

function applyPresenceRows(rows){
  const now=Date.now();
  for(const row of rows){
    if(!row || row.client_id===clientId)continue;
    const lastSeen=row.last_seen?new Date(row.last_seen).getTime():0;
    if(!lastSeen || now-lastSeen>3500)continue;
    if(!Number.isFinite(row.x) || !Number.isFinite(row.z))continue;

    const entry=ensureRemoteAvatar(row.client_id,{
      seatIndex:row.seat_index,
      displayName:row.display_name
    });
    if(!entry)continue;

    entry.targetPosition.set(row.x,0,row.z);
    if(Number.isFinite(row.yaw))entry.targetYaw=row.yaw;

    // First sighting must start at the actual remote coordinate, never at pavilion center.
    if(!entry.lastMotionAt){
      entry.root.position.copy(entry.targetPosition);
      entry.root.rotation.y=entry.targetYaw;
    }
    entry.lastMotionAt=performance.now();

    if(row.state==='working'){
      playRemote(entry,entry.actions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit');
    }else{
      if(!Number.isFinite(row.seat_index))entry.seatIndex=null; refreshStandingAvatarColors();
      if(row.state==='walking')playRemote(entry,'Avatar_Walk');
      else playRemote(entry,'Avatar_Idle');
    }
  }
}

async function fetchPresenceOnly(){
  const {data,error}=await fetchPresence(supabase);
  if(error){console.warn('presence poll',error);return;}

  const rows=data||[];
  const now=Date.now();
  const freshIds=new Set();

  for(const row of rows){
    if(!row || row.client_id===clientId)continue;
    const lastSeen=row.last_seen?new Date(row.last_seen).getTime():0;
    if(lastSeen && now-lastSeen<=3500)freshIds.add(row.client_id);
  }

  // Polling is authoritative: if a client is not genuinely fresh anymore,
  // remove its rendered avatar immediately instead of letting it blink for ~10s.
  for(const [id,entry] of [...remoteAvatars]){
    const seated=seatSlots.some(seat=>seat.serverOccupant===id);
    if(!freshIds.has(id) && !seated){
      disposeRemoteAvatar(entry);
      remoteMotion.delete(id);
      refreshStandingAvatarColors();
    }
  }

  applyPresenceRows(rows.filter(row=>{
    if(!row || row.client_id===clientId)return false;
    const lastSeen=row.last_seen?new Date(row.last_seen).getTime():0;
    return !!lastSeen && now-lastSeen<=3500;
  }));
}

function handlePresenceChange(payload){
  const row=payload?.new;
  if(row)applyPresenceRows([row]);
}

async function serverPresencePulse(){
  if(!avatarRoot)return;
  const state=playerSeat?'working':((moveTarget||keys.size)?'walking':'idle');
  await supabase.from('atelier_presence').upsert({
    client_id:clientId,
    seat_index:playerSeat?.index ?? null,
    state,
    work_seconds:Math.floor(workElapsedSeconds),
    display_name:displayName,
    x:avatarRoot.position.x,
    z:avatarRoot.position.z,
    yaw:avatarRoot.rotation.y,
    last_seen:new Date().toISOString()
  });
}

function handleRemoteMotion(message){
  const p=message?.payload;
  if(!p || p.clientId===clientId || !Number.isFinite(p.x) || !Number.isFinite(p.z))return;

  remoteMotion.set(p.clientId,{...p,receivedAt:performance.now()});
  const entry=ensureRemoteAvatar(p.clientId,{seatIndex:p.seatIndex,displayName:p.displayName});
  if(!entry)return;

  entry.targetPosition.set(p.x,0,p.z);
  entry.targetYaw=Number.isFinite(p.yaw)?p.yaw:entry.root.rotation.y;
  entry.lastMotionAt=performance.now();

  if(p.state==='working'){
    playRemote(entry,entry.actions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit');
  }else{
    if(!Number.isFinite(p.seatIndex))entry.seatIndex=null; refreshStandingAvatarColors();
    if(p.state==='walking')playRemote(entry,'Avatar_Walk');
    else playRemote(entry,'Avatar_Idle');
  }
}

function broadcastMotion(force=false){
  if(!realtimeChannel || !avatarRoot)return;
  const now=performance.now();
  if(!force && now-lastMotionSentAt<100)return;
  lastMotionSentAt=now;

  const state=playerSeat?'working':((moveTarget||keys.size)?'walking':'idle');
  realtimeChannel.send({
    type:'broadcast',
    event:'motion',
    payload:{
      clientId,
      x:avatarRoot.position.x,
      z:avatarRoot.position.z,
      yaw:avatarRoot.rotation.y,
      state,
      seatIndex:playerSeat?.index ?? pendingPlayerSeat?.index ?? null,
      displayName
    }
  });
}

const GREET_DISTANCE=1.55;
const GREET_COOLDOWN_MS=18000;
const GREET_DURATION_MS=1600;
let localGreetingUntil=0;
const greetingPairCooldown=new Map();

function playSynchronizedGreeting(entry,startAtMs){
  if(!entry || !avatarRoot || playerSeat)return;
  const delay=Math.max(0,startAtMs-Date.now());

  setTimeout(()=>{
    if(!remoteAvatars.has(entry.clientId) || playerSeat)return;

    const dx=entry.root.position.x-avatarRoot.position.x;
    const dz=entry.root.position.z-avatarRoot.position.z;
    if(Math.hypot(dx,dz)>GREET_DISTANCE+.45)return;

    avatarRoot.rotation.y=Math.atan2(dx,dz)+MODEL_YAW_CORRECTION;
    entry.root.rotation.y=Math.atan2(-dx,-dz)+MODEL_YAW_CORRECTION;

    localGreetingUntil=performance.now()+GREET_DURATION_MS;
    entry.greetingUntil=performance.now()+GREET_DURATION_MS;

    const greetText=t('👋 반가워요!','👋 Hi!');
    setAvatarNameLabel(avatarRoot,greetText);
    setAvatarNameLabel(entry.root,greetText);
    const ownGreetLabel=avatarRoot.getObjectByName('Player Name Label');
    const remoteGreetLabel=entry.root.getObjectByName('Player Name Label');
    if(ownGreetLabel)ownGreetLabel.visible=true;
    if(remoteGreetLabel)remoteGreetLabel.visible=true;

    if(avatarActions?.['Avatar_Greet'])playAvatar('Avatar_Greet',.08);
    if(entry.actions?.['Avatar_Greet'])playRemote(entry,'Avatar_Greet');

    setTimeout(()=>{
      if(!playerSeat)playAvatar('Avatar_Idle',.10);
      if(remoteAvatars.has(entry.clientId))playRemote(entry,'Avatar_Idle');
      setAvatarNameLabel(avatarRoot,displayName);
      if(remoteAvatars.has(entry.clientId)){
        setAvatarNameLabel(entry.root,entry.displayName||t('이름 없는 화가','Unnamed artist'));
      }
    },GREET_DURATION_MS);
  },delay);
}

function handleGreetingBroadcast(message){
  const p=message?.payload;
  if(!p || !p.from || !p.to || !Number.isFinite(p.startAt))return;
  if(clientId!==p.from && clientId!==p.to)return;
  const otherId=clientId===p.from?p.to:p.from;
  const entry=remoteAvatars.get(otherId);
  if(!entry)return;
  playSynchronizedGreeting(entry,p.startAt);
}

function maybeTriggerNearbyGreeting(entry,distance){
  if(distance>GREET_DISTANCE || playerSeat || !entry?.clientId)return;

  const pair=[clientId,entry.clientId].sort().join('|');
  const now=Date.now();
  if(now-(greetingPairCooldown.get(pair)||0)<GREET_COOLDOWN_MS)return;

  // Only one side initiates, preventing duplicate greeting events.
  if(clientId!==[clientId,entry.clientId].sort()[0])return;

  greetingPairCooldown.set(pair,now);
  entry.lastGreetingAt=performance.now();

  const startAt=Date.now()+350;
  playSynchronizedGreeting(entry,startAt);

  realtimeChannel?.send({
    type:'broadcast',
    event:'greeting',
    payload:{from:clientId,to:entry.clientId,startAt}
  });
}

function updateProximityNameLabels(){
  if(!avatarRoot)return;

  const showDistance=3.6;
  const hideDistance=4.2;

  for(const entry of remoteAvatars.values()){
    const label=entry.root.getObjectByName('Player Name Label');
    if(!label)continue;

    // Use floor-plane distance only so vertical offsets never suppress the tag.
    const dx=entry.root.position.x-avatarRoot.position.x;
    const dz=entry.root.position.z-avatarRoot.position.z;
    const d=Math.hypot(dx,dz);
    maybeTriggerNearbyGreeting(entry,d);

    if(label.visible){
      if(d>hideDistance)label.visible=false;
    }else{
      if(d<=showDistance)label.visible=true;
    }
  }

  // My own label stays visible; remote labels are proximity-based.
  const ownLabel=avatarRoot.getObjectByName('Player Name Label');
  if(ownLabel)ownLabel.visible=true;
}

function cleanupOrphanRemoteRoots(){
  for(const child of [...scene.children]){
    const id=child?.userData?.remoteClientId;
    if(!id)continue;
    const mapped=remoteAvatars.get(id);
    if(!mapped || mapped.root!==child)scene.remove(child);
  }
}

function updateRemoteMotion(dt){
  cleanupOrphanRemoteRoots();
  const now=performance.now();
  for(const [id,entry] of [...remoteAvatars]){
    entry.root.position.lerp(entry.targetPosition,Math.min(1,dt*10));
    let delta=entry.targetYaw-entry.root.rotation.y;
    delta=Math.atan2(Math.sin(delta),Math.cos(delta));
    entry.root.rotation.y+=delta*Math.min(1,dt*10);

    if(now-entry.lastMotionAt>2500 && !seatSlots.some(seat=>seat.serverOccupant===id)){
      disposeRemoteAvatar(entry);
      remoteMotion.delete(id);
    }
  }
}

function startRealtimeSync(){
  if(realtimeChannel)return;
  realtimeChannel=supabase.channel('atelier-live',{config:{broadcast:{self:false,ack:false}}})
    .on('postgres_changes',{event:'*',schema:'public',table:'atelier_easels'},fetchServerState)
    .on('postgres_changes',{event:'*',schema:'public',table:'atelier_artworks'},fetchServerState)
    .on('postgres_changes',{event:'*',schema:'public',table:'atelier_presence'},handlePresenceChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'atelier_likes'},()=>{ if(artModal.classList.contains('show'))refreshPreviewLikeState(); })
    .on('broadcast',{event:'motion'},handleRemoteMotion)
    .on('broadcast',{event:'greeting'},handleGreetingBroadcast)
    .subscribe(status=>{
      if(status==='SUBSCRIBED')broadcastMotion(true);
    });
}

async function adoptGuestDataIntoAccount(user){
  if(!user)return;
  ownerId=user.id;
  currentUser=user;

  const {error:adoptError}=await adoptGuestData(supabase,clientId);
  if(adoptError)console.warn('guest adoption',adoptError);

  const {data:profile,error:profileError}=await fetchProfile(supabase,user.id);

  if(profileError)console.warn('profile lookup',profileError);

  if(profile?.display_name){
    displayName=makeLocalizedDisplayName(user.id,IS_KO);
    saveDisplayName(displayName);
    if(profile.display_name!==displayName){
      const {error:profileRenameError}=await updateProfileName(supabase,user.id,displayName);
      if(profileRenameError)console.warn('profile localized rename',profileRenameError);
    }
  }else{
    displayName=makeLocalizedDisplayName(user.id,IS_KO);
    saveDisplayName(displayName);
    const {error:profileInsertError}=await createProfile(supabase,user.id,displayName);
    if(profileInsertError && profileInsertError.code!=='23505')console.warn('profile create',profileInsertError);
  }

  // Today's HUD timer is restored only from the current local timer version.
  // Historical server rows are intentionally not used here because development/test
  // sessions previously left stale seated-time values in atelier_daily_work.

  activeWorkId=null;
  activeWorkCoverUrl=null;
  await findActiveWork();
  await fetchServerState();

  if(avatarRoot)setAvatarNameLabel(avatarRoot,displayName);
  accountBtn.textContent='👤';
  accountEmail.style.display='none';
  accountAction.style.display='none';
  logoutBtn.style.display='block';
  accountState.textContent=IS_KO ? `${user.email||'로그인됨'} · 작품 기록이 이 계정에 저장돼요.` : `${user.email||'Logged in'} · Artwork progress is saved to this account.`;
}

function resetToGuestIdentity(){
  currentUser=null;
  ownerId=clientId;
  activeWorkId=null;
  activeWorkCoverUrl=null;
  accountBtn.textContent='👤';
  accountEmail.style.display='block';
  accountAction.style.display='block';
  logoutBtn.style.display='none';
  accountState.textContent=t('로그인하면 다른 기기에서도 같은 기록을 이어볼 수 있어요.','Log in to continue the same progress across devices.');
}

async function refreshAuthSession(){
  const {data:{session}}=await getAuthSession(supabase);
  if(session?.user)await adoptGuestDataIntoAccount(session.user);
  else resetToGuestIdentity();
}

accountBtn.addEventListener('click',()=>{
  accountModal.classList.add('show');
});
accountClose.addEventListener('click',()=>accountModal.classList.remove('show'));
accountModal.addEventListener('click',e=>{
  if(e.target===accountModal)accountModal.classList.remove('show');
});

accountAction.addEventListener('click',async ()=>{
  const email=accountEmail.value.trim();
  if(!email){
    accountState.textContent=t('이메일 주소를 입력해 주세요.','Enter your email address.');
    return;
  }

  accountAction.disabled=true;
  accountState.textContent=t('로그인 링크를 보내는 중...','Sending login link...');

  const {error}=await sendMagicLink(supabase,{
    email,
    redirectTo:'https://atelier-3d-gray.vercel.app/viewer.html'
  });

  if(error){
    accountAction.disabled=false;
    console.warn('magic link',error);
    if(error.code==='over_email_send_rate_limit' || error.status===429){
      accountState.textContent=t('로그인 메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.','Too many login emails requested. Please try again later.');
    }else{
      accountState.textContent=t('로그인 링크를 보내지 못했어요. 잠시 후 다시 시도해 주세요.','Could not send the login link. Please try again later.');
    }
    return;
  }

  accountState.textContent=t('메일을 확인해 주세요. 처음이면 계정도 자동으로 만들어져요.','Check your email. A new account will be created automatically if needed.');
  accountAction.disabled=true;
  let cooldown=60;
  const originalText=t('로그인 링크 받기','Send login link');
  const timer=setInterval(()=>{
    cooldown--;
    accountAction.textContent=t(`다시 보내기 ${cooldown}초`,`Resend in ${cooldown}s`);
    if(cooldown<=0){
      clearInterval(timer);
      accountAction.disabled=false;
      accountAction.textContent=originalText;
    }
  },1000);
});

logoutBtn.addEventListener('click',async ()=>{
  await signOut(supabase);
  resetToGuestIdentity();
  accountModal.classList.remove('show');
  showStatus('로그아웃했어요');
});

supabase.auth.onAuthStateChange((_event,session)=>{
  setTimeout(()=>{
    if(session?.user)adoptGuestDataIntoAccount(session.user);
    else resetToGuestIdentity();
  },0);
});

async function findActiveWork(){
  if(activeWorkId)return activeWorkId;

  const {data:existing,error:existingError}=await findActiveWorkRow(supabase,ownerId);

  if(existingError){
    console.warn('active work lookup',existingError);
    return null;
  }

  if(existing){
    activeWorkId=existing.id;
    activeWorkCoverUrl=existing.cover_image_url||null;
    currentWorkElapsedSeconds=Math.max(currentWorkElapsedSeconds,Number(existing.total_work_seconds)||0);
    saveProgress();
    return activeWorkId;
  }

  return null;
}

async function ensureActiveWork(){
  const found=await findActiveWork();
  if(found)return found;

  const {data:created,error:createError}=await createActiveWorkRow(supabase,{
    ownerId,displayName,totalWorkSeconds:currentWorkElapsedSeconds
  });

  if(createError){
    console.warn('active work create',createError);
    return null;
  }

  activeWorkId=created.id;
  activeWorkCoverUrl=null;
  return activeWorkId;
}

async function uploadArtworkToStorage(dataUrl,workId){
  return uploadArtworkFile(supabase,{ownerId,workId,dataUrl});
}
async function completeCurrentWork(){
  if(!currentUser){
    showStatus('작품을 보관하려면 계정을 먼저 만들어 주세요',2800);
    historyModal.classList.remove('show');
    accountModal.classList.add('show');
    accountState.textContent='완성 작품을 보관하려면 이메일로 계정을 만들어 주세요.';
    return;
  }

  await artworkSaveQueue;
  const workId=await findActiveWork();
  if(!workId){
    showStatus('진행 중인 작품이 없어요');
    return;
  }

  completeWorkBtn.disabled=true;

  const {error}=await completeWorkRow(supabase,{
    workId,ownerId,totalWorkSeconds:currentWorkElapsedSeconds,coverImageUrl:activeWorkCoverUrl
  });

  if(error){
    console.warn('complete work',error);
    showStatus('작품 완료 저장에 실패했어요');
    completeWorkBtn.disabled=false;
    return;
  }

  activeWorkId=null;
  activeWorkCoverUrl=null;
  currentWorkElapsedSeconds=0;
  saveProgress();
  showStatus('작품을 완성했어요 · 다음 작품은 0분부터 시작해요',3200);
  await loadMyHistory();
}

completeWorkBtn.addEventListener('click',completeCurrentWork);

async function deleteWorkCompletely(workId,{active=false}={}){
  if(!workId)return false;

  const [{data:historyRows},{data:currentRows}]=await Promise.all([
    supabase.from('atelier_artwork_history').select('storage_path').eq('work_id',workId),
    supabase.from('atelier_artworks').select('storage_path').eq('work_id',workId)
  ]);

  const paths=[...(historyRows||[]),...(currentRows||[])]
    .map(r=>r.storage_path)
    .filter(Boolean);
  const uniquePaths=[...new Set(paths)];

  await supabase.from('atelier_artworks').delete().eq('work_id',workId);
  const {error}=await supabase.from('atelier_works')
    .delete()
    .eq('id',workId)
    .eq('owner_id',ownerId);

  if(error){
    console.warn('delete work',error);
    showStatus('작품을 삭제하지 못했어요');
    return false;
  }

  if(uniquePaths.length){
    const {error:storageError}=await supabase.storage.from('atelier-artworks').remove(uniquePaths);
    if(storageError)console.warn('delete storage files',storageError);
  }

  if(active){
    activeWorkId=null;
    activeWorkCoverUrl=null;
    currentWorkElapsedSeconds=0;
    if(playerArtworkSeat)clearArtworkFromSeat(playerArtworkSeat);
    savedArtworkDataUrl=null;
    savedArtworkSeatIndex=null;
    savedArtworkLockedUntil=0;
    saveProgress();
  }

  return true;
}

async function deleteCurrentWork(){
  const workId=await findActiveWork();
  if(!workId)return;
  if(!confirm('현재 작업 중인 작품과 진행 기록을 모두 삭제할까요?'))return;

  deleteCurrentWorkBtn.disabled=true;
  const ok=await deleteWorkCompletely(workId,{active:true});
  deleteCurrentWorkBtn.disabled=false;
  if(ok){
    showStatus('현재 작품을 폐기했어요');
    await loadMyHistory();
  }
}

async function deleteCompletedWork(workId){
  if(!confirm('이 완성 작품과 진행 기록을 모두 삭제할까요?'))return;
  const ok=await deleteWorkCompletely(workId);
  if(ok){
    showStatus('완성 작품을 삭제했어요');
    await loadMyHistory();
  }
}

deleteCurrentWorkBtn.addEventListener('click',deleteCurrentWork);

async function syncDailyWorkToServer(){
  const {error}=await supabase.from('atelier_daily_work').upsert({
    owner_id:ownerId,
    work_date:localDateKey(),
    work_seconds:Math.floor(workElapsedSeconds),
    display_name:displayName,
    updated_at:new Date().toISOString()
  },{onConflict:'owner_id,work_date'});
  if(error)console.warn('daily work sync',error);
}

async function loadMyHistory(){
  historyModal.classList.add('show');
  completedGrid.innerHTML='';
  progressSlides=[];
  progressSlideIndex=0;

  const workId=await findActiveWork();

  const {historyRes,dailyRes,completedRes}=await fetchHistoryBundle(supabase,{
    ownerId,workId,workDate:localDateKey()
  });
  const {data:history,error:hErr}=historyRes;
  const {data:daily,error:dErr}=dailyRes;
  const {data:completed,error:cErr}=completedRes;

  if(hErr || dErr || cErr){
    console.warn(hErr||dErr||cErr);
    showStatus('기록을 불러오지 못했어요');
    return;
  }

  const todaySeconds=Math.max(workElapsedSeconds,Number(daily?.work_seconds)||0);

  if(workId && history?.length){
    currentProgressSection.style.display='block';
    progressSlides=history;
    progressSlideIndex=history.length-1;
    buildProgressSlides();
    completeWorkBtn.disabled=false;
    deleteCurrentWorkBtn.disabled=false;
    historySummary.textContent=`현재 작품 진행 과정 · ${history.length}단계 · 이 작품 ${formatTodayWork(currentWorkElapsedSeconds)}`;
    renderProgressSlide();
  }else{
    currentProgressSection.style.display='none';
    progressSlides=[];
  }

  if(!completed?.length){
    completedGrid.innerHTML='<div style="color:#8a7b72;font-size:12px">아직 완성한 작품이 없어요.</div>';
  }else{
    for(const work of completed){
      const card=document.createElement('div');
      card.className='completedItem';

      const img=document.createElement('img');
      img.src=work.cover_image_url||'';
      img.alt='완성 작품';
      img.addEventListener('click',()=>{
        if(!work.cover_image_url)return;
        const when=work.completed_at?new Date(work.completed_at):null;
        const meta=when
          ? t(`완성 작품 · ${when.toLocaleDateString()} · ${formatTodayWork(work.total_work_seconds||0)}`,`Completed · ${when.toLocaleDateString()} · ${formatTodayWork(work.total_work_seconds||0)}`)
          : t('완성 작품','Completed artwork');
        openArtworkModal(work.cover_image_url,meta,work.id);
      });

      const meta=document.createElement('div');
      meta.className='completedMeta';
      const when=work.completed_at?new Date(work.completed_at):null;
      meta.textContent=when
        ? `${when.toLocaleDateString()} · ${formatTodayWork(work.total_work_seconds||0)}`
        : formatTodayWork(work.total_work_seconds||0);

      const del=document.createElement('button');
      del.className='completedDelete';
      del.title='삭제';
      del.setAttribute('aria-label',t('삭제','Delete'));
      del.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>';
      del.addEventListener('click',e=>{
        e.stopPropagation();
        deleteCompletedWork(work.id);
      });

      card.append(img,meta,del);
      completedGrid.appendChild(card);
    }
  }
}
function buildProgressSlides(){
  progressCarousel.innerHTML='';
  for(const [index,item] of progressSlides.entries()){
    const img=document.createElement('img');
    img.src=item.image_url;
    img.alt=`진행 ${index+1}단계`;
    img.className='progressSlide';
    img.dataset.index=String(index);

    img.addEventListener('click',()=>{
      if(index===progressSlideIndex){
        openArtworkModal(
          item.image_url,
          t(`진행 ${index+1}/${progressSlides.length} · 이 작품 ${formatTodayWork(item.work_seconds||0)}`,
            `Progress ${index+1}/${progressSlides.length} · ${formatTodayWork(item.work_seconds||0)}`),
          item.work_id||activeWorkId
        );
        return;
      }
      progressSlideIndex=index;
      renderProgressSlide();
    });

    progressCarousel.appendChild(img);
  }
}

function renderProgressSlide(){
  if(!progressSlides.length)return;
  progressSlideIndex=Math.max(0,Math.min(progressSlideIndex,progressSlides.length-1));

  const active=progressSlides[progressSlideIndex];
  const slides=[...progressCarousel.querySelectorAll('.progressSlide')];

  for(const img of slides){
    const index=Number(img.dataset.index);
    const offset=index-progressSlideIndex;
    img.className='progressSlide '+(
      offset===0?'center':
      offset===-1?'left1':
      offset===1?'right1':
      offset===-2?'left2':
      offset===2?'right2':
      offset<0?'hiddenLeft':'hiddenRight'
    );
  }

  const when=new Date(active.created_at);
  progressMeta.textContent=`${progressSlideIndex+1} / ${progressSlides.length} · ${when.toLocaleDateString()} · 이 작품 ${formatTodayWork(active.work_seconds||0)}`;
}

let progressTouchStartX=null;
progressCarousel.addEventListener('pointerdown',e=>{
  progressTouchStartX=e.clientX;
});
progressCarousel.addEventListener('pointerup',e=>{
  if(progressTouchStartX==null)return;
  const dx=e.clientX-progressTouchStartX;
  progressTouchStartX=null;
  if(Math.abs(dx)<45)return;

  if(dx<0 && progressSlideIndex<progressSlides.length-1){
    progressSlideIndex++;
    renderProgressSlide();
  }else if(dx>0 && progressSlideIndex>0){
    progressSlideIndex--;
    renderProgressSlide();
  }
});
progressCarousel.addEventListener('pointercancel',()=>{progressTouchStartX=null;});


historyBtn.addEventListener('click',loadMyHistory);
historyClose.addEventListener('click',()=>historyModal.classList.remove('show'));
historyModal.addEventListener('click',e=>{
  if(e.target===historyModal)historyModal.classList.remove('show');
});

async function serverClaimSeat(seat){
  const {data,error}=await claimEasel(supabase,seat.index,clientId);
  if(error){console.warn(error);return false;}
  await fetchServerState();
  return data===true;
}

async function serverReleaseSeat(seat){
  if(!seat)return;
  await releaseEasel(supabase,seat.index,clientId);
  await upsertPresence(supabase,{
    client_id:clientId,seat_index:null,state:'idle',work_seconds:Math.floor(workElapsedSeconds),
    display_name:displayName,last_seen:new Date().toISOString()
  });
  await fetchServerState();
}

async function serverHeartbeat(){
  if(playerSeat){
    await heartbeatEasel(supabase,playerSeat.index,clientId);
    await upsertPresence(supabase,{
      client_id:clientId,seat_index:playerSeat.index,state:'working',
      work_seconds:Math.floor(workElapsedSeconds),display_name:displayName,last_seen:new Date().toISOString()
    });
  }
}

async function syncArtworkSnapshot(snapshot){
  const {dataUrl,seatIndex,workSeconds}=snapshot;
  const seat=seatSlots.find(s=>s.index===seatIndex);
  if(!seat || !dataUrl)return;

  const workId=await ensureActiveWork();
  if(!workId){
    showStatus('작품 기록을 만들지 못했어요');
    return;
  }

  // Moving the artwork to a new easel ends the old easel's exhibition immediately.
  for(const otherSeat of seatSlots){
    if(otherSeat.index!==seat.index && otherSeat.serverArtworkOwner===ownerId){
      otherSeat.artworkLockedUntil=0;
      otherSeat.serverArtworkOwner=null;
    }
  }

  let stored;
  try{
    stored=await uploadArtworkToStorage(dataUrl,workId);
  }catch(err){
    console.warn('storage upload',err);
    showStatus('이미지 저장에 실패했어요');
    return;
  }

  activeWorkCoverUrl=stored.url;

  await supabase.from('atelier_artworks').delete().eq('owner_id',ownerId);
  await supabase.from('atelier_artworks').delete().eq('seat_index',seat.index);
  const {error:artworkUpsertError}=await supabase.from('atelier_artworks').upsert({
    owner_id:ownerId,
    seat_index:seat.index,
    image_url:stored.url,
    storage_path:stored.path,
    work_id:workId,
    work_seconds:Math.floor(workSeconds),
    display_name:displayName,
    locked_until:null,
    updated_at:new Date().toISOString()
  },{onConflict:'seat_index'});

  if(artworkUpsertError){
    console.warn('artwork upsert',artworkUpsertError);
    showStatus(t('작품 저장에 실패했어요','Failed to save artwork'));
    return;
  }

  seat.serverArtworkOwner=ownerId;
  seat.userData=seat.userData||{};
  seat.userData.workId=workId;
  seat.userData.artworkDataUrl=stored.url;

  const {error:historyError}=await supabase.from('atelier_artwork_history').insert({
    owner_id:ownerId,
    work_id:workId,
    image_url:stored.url,
    storage_path:stored.path,
    work_seconds:Math.floor(workSeconds),
    display_name:displayName
  });
  if(historyError)console.warn('artwork history save',historyError);

  await supabase.from('atelier_works')
    .update({
      total_work_seconds:Math.floor(workSeconds),
      cover_image_url:stored.url
    })
    .eq('id',workId)
    .eq('owner_id',ownerId);

  const {data:historyRows}=await supabase.from('atelier_artwork_history')
    .select('id,storage_path,created_at')
    .eq('work_id',workId)
    .order('created_at',{ascending:false});

  if(historyRows?.length>12){
    const stale=historyRows.slice(12);
    const staleIds=stale.map(r=>r.id);
    const stalePaths=stale.map(r=>r.storage_path).filter(Boolean);

    await supabase.from('atelier_artwork_history').delete().in('id',staleIds);
    if(stalePaths.length){
      await supabase.storage.from('atelier-artworks').remove(stalePaths);
    }
  }

  await syncDailyWorkToServer();
}
function enqueueArtworkSave(dataUrl,seatIndex,workSeconds){
  const snapshot={dataUrl,seatIndex,workSeconds};
  artworkSaveQueue=artworkSaveQueue
    .then(()=>syncArtworkSnapshot(snapshot))
    .catch(err=>{
      console.warn('artwork save queue',err);
      showStatus('작품 저장 중 오류가 있었어요');
    });
  return artworkSaveQueue;
}

async function lockServerArtwork(seat,untilMs){
  if(!seat || savedArtworkSeatIndex!==seat.index)return;
  await supabase.from('atelier_artworks')
    .update({locked_until:new Date(untilMs).toISOString(),updated_at:new Date().toISOString()})
    .eq('owner_id',ownerId);
}

function localDateKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function loadProgress(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return;
    const data=JSON.parse(raw);

    totalWorkElapsedSeconds=Math.max(0,Number(data.totalSeconds)||0);
    workElapsedSeconds=(data.timerVersion===TIMER_DATA_VERSION && data.date===localDateKey())
      ? Math.max(0,Number(data.todaySeconds)||0)
      : 0;
    currentWorkElapsedSeconds=Math.max(0,Number(data.currentWorkSeconds)||0);

    savedArtworkDataUrl=typeof data.artworkDataUrl==='string' ? data.artworkDataUrl : null;
    savedArtworkSeatIndex=Number.isInteger(data.artworkSeatIndex) ? data.artworkSeatIndex : null;
    savedArtworkLockedUntil=Math.max(0,Number(data.artworkLockedUntil)||0);
  }catch(err){
    console.warn('Progress restore failed:',err);
  }
}

function saveProgress(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({
      timerVersion:TIMER_DATA_VERSION,
      date:localDateKey(),
      todaySeconds:workElapsedSeconds,
      totalSeconds:totalWorkElapsedSeconds,
      currentWorkSeconds:currentWorkElapsedSeconds,
      artworkDataUrl:savedArtworkDataUrl,
      artworkSeatIndex:savedArtworkSeatIndex,
      artworkLockedUntil:savedArtworkLockedUntil
    }));
  }catch(err){
    console.warn('Progress save failed:',err);
  }
}

function makeStoredArtworkDataUrl(img){
  const maxSide=1200;
  const srcW=img.naturalWidth||img.width;
  const srcH=img.naturalHeight||img.height;
  const scale=Math.min(1,maxSide/Math.max(srcW,srcH));
  const w=Math.max(1,Math.round(srcW*scale));
  const h=Math.max(1,Math.round(srcH*scale));

  const c=document.createElement('canvas');
  c.width=w;
  c.height=h;
  const ctx=c.getContext('2d');
  // Flatten transparent PNG/WebP onto the physical white canvas before JPEG persistence.
  // Otherwise transparent pixels become black after reload.
  ctx.fillStyle='#f7f4ed';
  ctx.fillRect(0,0,w,h);
  ctx.drawImage(img,0,0,w,h);

  // JPEG keeps localStorage use small enough for normal artwork screenshots/photos.
  return c.toDataURL('image/jpeg',.82);
}

function applySavedArtworkLock(){
  if(savedArtworkSeatIndex===null)return;
  const seat=seatSlots.find(s=>s.index===savedArtworkSeatIndex);
  if(!seat)return;

  if(savedArtworkLockedUntil>Date.now()){
    seat.artworkLockedUntil=savedArtworkLockedUntil;
  }else{
    savedArtworkLockedUntil=0;
  }
}

function updateArtworkLocks(){
  const now=Date.now();
  for(const seat of seatSlots){
    if(!seat.artworkLockedUntil || seat.artworkLockedUntil>now)continue;

    seat.artworkLockedUntil=0;
    if(playerArtworkSeat===seat || savedArtworkSeatIndex===seat.index){
      clearArtworkFromSeat(seat);
    }
  }
}

function restoreSavedArtwork(){
  if(!savedArtworkDataUrl || savedArtworkSeatIndex===null)return;

  const seat=seatSlots.find(s=>s.index===savedArtworkSeatIndex);
  if(!seat){
    savedArtworkDataUrl=null;
    savedArtworkSeatIndex=null;
    savedArtworkLockedUntil=0;
    supabase.from('atelier_artworks').update({locked_until:null,updated_at:new Date().toISOString()}).eq('owner_id',ownerId);
    saveProgress();
    return;
  }

  if(savedArtworkLockedUntil && savedArtworkLockedUntil<=Date.now()){
    savedArtworkDataUrl=null;
    savedArtworkSeatIndex=null;
    savedArtworkLockedUntil=0;
    seat.artworkLockedUntil=0;
    saveProgress();
    return;
  }

  const img=new Image();
  if(/^https?:\/\//i.test(savedArtworkDataUrl))img.crossOrigin='anonymous';
  img.onload=()=>{
    const canvases=getCanvasMeshesForSeat(seat);
    canvases.forEach(mesh=>makeArtworkOverlay(mesh,img,seat));
    playerArtworkSeat=seat;
  };
  img.onerror=()=>{
    savedArtworkDataUrl=null;
    savedArtworkSeatIndex=null;
    saveProgress();
  };
  img.src=savedArtworkDataUrl;
}

function releasePlayerSeat(){
  const releasedSeat=playerSeat;
  if(playerSeat){
    if(playerSeat.occupiedBy==='player')playerSeat.occupiedBy=null;

    if(playerArtworkSeat===playerSeat && savedArtworkDataUrl){
      const until=Date.now()+ARTWORK_HOLD_MS;
      playerSeat.artworkLockedUntil=until;
      savedArtworkLockedUntil=until;
      savedArtworkSeatIndex=playerSeat.index;
      saveProgress();
      lockServerArtwork(playerSeat,until);
    }
  }

  if(releasedSeat)serverReleaseSeat(releasedSeat);
  if(pendingPlayerSeat?.occupiedBy==='player')pendingPlayerSeat.occupiedBy=null;
  playerSeat=null;
  pendingPlayerSeat=null;
  if(avatarModel){
    recolorBeret(avatarModel,standingPlayerHatColor());
    refreshStandingAvatarColors();
  }
}

function isCanvasMesh(o){
  if(!o?.isMesh)return false;
  const objectName=(o.name||'').toLowerCase();
  const mats=Array.isArray(o.material)?o.material:[o.material];
  return (
    objectName.includes('canvas') ||
    objectName.includes('painting') ||
    objectName.includes('artwork') ||
    mats.some(m=>(m?.name||'').toLowerCase()==='canvas')
  );
}

function getCanvasMeshesForSeat(seat){
  const meshes=[];
  seat?.easel?.traverse(o=>{
    if(isCanvasMesh(o))meshes.push(o);
  });
  return meshes;
}

function getSeatArtworkDataUrl(seat){
  if(!seat)return null;
  if(seat.userData?.artworkDataUrl)return seat.userData.artworkDataUrl;
  if(savedArtworkSeatIndex===seat.index && savedArtworkDataUrl)return savedArtworkDataUrl;

  const canvases=getCanvasMeshesForSeat(seat);
  for(const mesh of canvases){
    const overlay=mesh.getObjectByName('Artwork Overlay');
    const image=overlay?.material?.map?.image;
    if(image?.toDataURL){
      try{return image.toDataURL('image/png');}catch{}
    }
  }
  return null;
}

async function refreshPreviewLikeState(){
  if(!previewWorkId){
    artLikeBtn.style.display='none';
    return;
  }

  artLikeBtn.style.display='inline-flex';
  artLikeBtn.disabled=false;

  const countQuery=supabase
    .from('atelier_likes')
    .select('*',{count:'exact',head:true})
    .eq('work_id',previewWorkId);

  let liked=false;
  const [countRes,ownRes]=await Promise.all([
    countQuery,
    currentUser
      ? supabase.from('atelier_likes').select('work_id').eq('work_id',previewWorkId).eq('user_id',currentUser.id).maybeSingle()
      : Promise.resolve({data:null,error:null})
  ]);

  if(countRes.error)console.warn('like count',countRes.error);
  if(ownRes.error)console.warn('like own',ownRes.error);

  liked=!!ownRes.data;
  const count=countRes.count||0;
  artLikeBtn.classList.toggle('liked',liked);
  artLikeBtn.innerHTML=`<span class="heart">${liked?'♥':'♡'}</span><span class="label">${t('좋아요','Like')}</span><span class="count">${count}</span>`;
}

async function renderCompletedArchiveForPreview(workId){
  artArchiveSection.style.display='none';
  artArchiveGrid.innerHTML='';
  if(!workId)return;

  const {data:work,error:workError}=await fetchWorkById(supabase,workId);

  if(workError){
    console.warn('preview work lookup',workError);
    return;
  }
  if(!work || work.status!=='completed' || !work.owner_id)return;

  const {data:completed,error:completedError}=await fetchCompletedWorks(supabase,work.owner_id);

  if(completedError){
    console.warn('preview completed archive',completedError);
    return;
  }
  if(!completed?.length)return;

  artArchiveTitle.textContent=t('완성 작품 보관함','Completed artworks');
  artArchiveSection.style.display='block';

  for(const item of completed){
    if(!item.cover_image_url)continue;
    const card=document.createElement('div');
    card.className='artArchiveItem'+(item.id===workId?' active':'');
    const img=document.createElement('img');
    img.src=item.cover_image_url;
    img.alt=t('완성 작품','Completed artwork');
    const metaEl=document.createElement('div');
    metaEl.className='artArchiveMeta';
    const when=item.completed_at?new Date(item.completed_at):null;
    metaEl.textContent=when
      ? `${when.toLocaleDateString()} · ${formatTodayWork(item.total_work_seconds||0)}`
      : formatTodayWork(item.total_work_seconds||0);
    card.append(img,metaEl);
    card.addEventListener('click',async ()=>{
      previewWorkId=item.id;
      artPreview.src=item.cover_image_url;
      artMeta.textContent=when
        ? t(`완성 작품 · ${when.toLocaleDateString()} · ${formatTodayWork(item.total_work_seconds||0)}`,`Completed · ${when.toLocaleDateString()} · ${formatTodayWork(item.total_work_seconds||0)}`)
        : t('완성 작품','Completed artwork');
      artArchiveGrid.querySelectorAll('.artArchiveItem').forEach(el=>el.classList.remove('active'));
      card.classList.add('active');
      await refreshPreviewLikeState();
    });
    artArchiveGrid.appendChild(card);
  }
}

async function openArtworkModal(src,meta,workId=null){
  if(!src)return false;
  previewWorkId=workId||null;
  artPreview.src=src;
  artMeta.textContent=meta||'';
  artArchiveSection.style.display='none';
  artArchiveGrid.innerHTML='';
  artModal.classList.add('show');
  await Promise.all([
    refreshPreviewLikeState(),
    renderCompletedArchiveForPreview(previewWorkId)
  ]);
  return true;
}

artLikeBtn.addEventListener('click',async ()=>{
  if(!previewWorkId)return;
  if(!currentUser){
    artModal.classList.remove('show');
    accountModal.classList.add('show');
    accountState.textContent=t(
      '좋아요를 누르려면 먼저 로그인해 주세요.',
      'Log in to like artworks.'
    );
    return;
  }

  artLikeBtn.disabled=true;
  const {data:existing,error:checkError}=await supabase
    .from('atelier_likes')
    .select('work_id')
    .eq('work_id',previewWorkId)
    .eq('user_id',currentUser.id)
    .maybeSingle();

  if(checkError){
    console.warn('like lookup',checkError);
    artLikeBtn.disabled=false;
    return;
  }

  if(existing){
    const {error}=await supabase
      .from('atelier_likes')
      .delete()
      .eq('work_id',previewWorkId)
      .eq('user_id',currentUser.id);
    if(error)console.warn('unlike',error);
  }else{
    const {error}=await supabase
      .from('atelier_likes')
      .insert({work_id:previewWorkId,user_id:currentUser.id});
    if(error)console.warn('like',error);
  }
  await refreshPreviewLikeState();
});

function openArtworkPreview(seat){
  const src=getSeatArtworkDataUrl(seat);
  if(!src)return false;

  const seatWorkId=seat?.userData?.workId||null;
  const isOwnActiveArtwork=
    !!activeWorkId &&
    (
      seatWorkId===activeWorkId ||
      (seat?.serverArtworkOwner===ownerId && !seatWorkId)
    );

  // Only the genuinely active work opens progress history.
  // A completed work can remain exhibited on the same easel, but it must open
  // as a completed artwork preview with the completed archive beneath it.
  if(isOwnActiveArtwork){
    loadMyHistory();
    return true;
  }

  const meta=seat.userData?.artworkMeta || t('아틀리에 작품','Atelier artwork');
  openArtworkModal(src,meta,seatWorkId);
  return true;
}

function closeArtworkPreview(){
  artModal.classList.remove('show');
  artPreview.removeAttribute('src');
  previewWorkId=null;
  artLikeBtn.style.display='none';
  artArchiveSection.style.display='none';
  artArchiveGrid.innerHTML='';
}

artClose.addEventListener('click',closeArtworkPreview);
artModal.addEventListener('click',e=>{
  if(e.target===artModal)closeArtworkPreview();
});

function isLegacyInlineArtworkSeat(seat){
  const url=seat?.userData?.artworkDataUrl;
  const workId=seat?.userData?.workId;
  return !workId && typeof url==='string' && url.startsWith('data:image/');
}

function seatHasVisibleArtwork(seat){
  if(!seat)return false;
  return getCanvasMeshesForSeat(seat).some(mesh=>{
    const overlay=mesh.getObjectByName('Artwork Overlay');
    return !!(overlay && overlay.visible!==false && overlay.material?.map);
  });
}

function openArtworkPickerForSeat(seat){
  if(!playerSeat || seat!==playerSeat){
    showStatus('이젤에 앉아 있는 동안 내 캔버스를 클릭해 주세요');
    return true;
  }

  if(
    seat.serverArtworkOwner &&
    seat.serverArtworkOwner!==ownerId &&
    seatHasVisibleArtwork(seat) &&
    !isLegacyInlineArtworkSeat(seat)
  ){
    showStatus(blockedEaselStatus(seat),4200); blockedPromptSeat=seat; blockedPromptUntil=performance.now()+12000;
    return true;
  }

  // If the seat looks empty but an old owner row is still attached to this seat index
  // after furniture remapping, treat that server owner as stale and allow a new upload.
  if(seat.serverArtworkOwner && seat.serverArtworkOwner!==ownerId && !seatHasVisibleArtwork(seat)){
    console.warn('Ignoring stale artwork owner on visually empty seat',seat.index,seat.serverArtworkOwner);
    seat.serverArtworkOwner=null;
  }

  const canvases=getCanvasMeshesForSeat(seat);
  if(!canvases.length){
    showStatus('이 이젤의 캔버스 메시를 찾지 못했어요');
    return true;
  }

  artUpload.value='';
  artUpload.click();
  return true;
}

function tryOpenArtworkOnClickedCanvas(){
  if(!furnitureScene || !playerSeat)return false;

  const hits=raycaster.intersectObject(furnitureScene,true);
  for(const hit of hits){
    let o=hit.object;
    let seat=null;
    let p=o;
    while(p){
      if(p.userData?.seatSlot){seat=p.userData.seatSlot;break;}
      p=p.parent;
    }

    if(seat===playerSeat && isCanvasMesh(o)){
      return openArtworkPickerForSeat(seat);
    }
  }
  return false;
}

function clearArtworkFromSeat(seat){
  if(!seat)return;
  const canvases=getCanvasMeshesForSeat(seat);
  canvases.forEach(mesh=>{
    const old=mesh.getObjectByName('Artwork Overlay');
    if(!old)return;
    old.geometry?.dispose?.();
    old.material?.map?.dispose?.();
    old.material?.dispose?.();
    mesh.remove(old);
  });
  if(playerArtworkSeat===seat)playerArtworkSeat=null;
  if(seat)seat.artworkLockedUntil=0;
  if(savedArtworkSeatIndex===seat?.index){
    savedArtworkDataUrl=null;
    savedArtworkSeatIndex=null;
    savedArtworkLockedUntil=0;
    saveProgress();
  }
}

function applyArtworkImage(img){
  if(!playerSeat)return;

  if(playerArtworkSeat && playerArtworkSeat!==playerSeat){
    clearArtworkFromSeat(playerArtworkSeat);
  }

  const canvases=getCanvasMeshesForSeat(playerSeat);
  if(!canvases.length){
    showStatus('캔버스 메시를 찾지 못했어요');
    return;
  }

  canvases.forEach(mesh=>{
    makeArtworkOverlay(mesh,img,playerSeat);
  });

  playerArtworkSeat=playerSeat;
  savedArtworkDataUrl=makeStoredArtworkDataUrl(img);
  savedArtworkSeatIndex=playerSeat.index;
  savedArtworkLockedUntil=0;
  playerSeat.artworkLockedUntil=0;
  saveProgress();
  enqueueArtworkSave(savedArtworkDataUrl,playerSeat.index,currentWorkElapsedSeconds)
    .then(()=>showStatus('작품 진행 단계가 저장됐어요'));
  showStatus('작품 저장 중...');
}

artUpload.addEventListener('change',()=>{
  const file=artUpload.files?.[0];
  if(!file || !playerSeat)return;

  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    applyArtworkImage(img);
    URL.revokeObjectURL(url);
  };
  img.onerror=()=>{
    URL.revokeObjectURL(url);
    showStatus('이미지를 불러오지 못했어요');
  };
  img.src=url;
});

function isMyArtworkSeat(seat){
  return !!seat && (
    seat.serverArtworkOwner===ownerId ||
    (seat.serverArtworkOwner==null && savedArtworkSeatIndex===seat.index && playerArtworkSeat===seat)
  );
}

async function requestPlayerSeat(seat){
  if(!seat)return false;

  if(seat.serverOccupant && seat.serverOccupant!==clientId){
    showStatus('지금 다른 사람이 앉아 있어요');
    return true;
  }

  if(isArtworkLocked(seat) && !isMyArtworkSeat(seat)){
    showStatus(blockedEaselStatus(seat),4200); blockedPromptSeat=seat; blockedPromptUntil=performance.now()+12000;
    return true;
  }

  // Only the actual artwork owner may reopen a locked easel immediately.
  if(isArtworkLocked(seat) && isMyArtworkSeat(seat)){
    seat.artworkLockedUntil=0;
    savedArtworkLockedUntil=0;
    supabase.from('atelier_artworks')
      .update({locked_until:null,updated_at:new Date().toISOString()})
      .eq('owner_id',ownerId)
      .eq('seat_index',seat.index);
    saveProgress();
  }

  if(seat.occupiedBy && seat.occupiedBy!=='player'){
    const npc=seat.occupiedBy;
    if(npc?.state==='goingToSeat'){
      // Visually empty seats stay available to the player; reroute the NPC instead.
      if(npc.seat===seat)npc.seat=null;
      npc.target=randomWalkTarget(npc);
      npc.state='walking';
      playNPC(npc,'Avatar_Walk');
      seat.occupiedBy=null;
    }else{
      showStatus('지금 다른 사람이 앉아 있어요');
      return true;
    }
  }

  const previousSeat=playerSeat;
  if(previousSeat && previousSeat!==seat)releasePlayerSeat();

  const claimed=await serverClaimSeat(seat);
  if(!claimed){
    showStatus('방금 다른 사람이 먼저 앉았어요');
    return true;
  }

  seat.occupiedBy='player';
  pendingPlayerSeat=seat;
  moveTarget=seat.position.clone();
  playAvatar('Avatar_Walk');
  showStatus('스툴로 이동 중');
  return true;
}

function trySitOnClickedStool(){
  if(!furnitureScene || !seatSlots.length)return false;

  // 1) Exact mesh hit.
  const hits=raycaster.intersectObject(furnitureScene,true);
  for(const hit of hits){
    let o=hit.object;
    while(o){
      if(o.userData?.seatSlot)return requestPlayerSeat(o.userData.seatSlot);
      o=o.parent;
    }
  }

  // 2) Wide ground-proximity fallback so clicking the seat is forgiving.
  const groundHit=new THREE.Vector3();
  if(raycaster.ray.intersectPlane(groundPlane,groundHit)){
    let nearest=null;
    let best=Infinity;
    for(const seat of seatSlots){
      const d=Math.hypot(groundHit.x-seat.position.x,groundHit.z-seat.position.z);
      if(d<seat.clickRadius && d<best){
        best=d;
        nearest=seat;
      }
    }
    if(nearest)return requestPlayerSeat(nearest);
  }

  return false;
}

function updateNPCs(dt,now){
  for(const npc of npcs){
    npc.mixer.update(dt);

    if(npc.state==='seated'){
      if(now>=npc.stateUntil){
        releaseSeat(npc);
        npc.state='idle';
        npc.stateUntil=now+THREE.MathUtils.randFloat(1.5,4.0);
        playNPC(npc,'Avatar_Idle');
      }
      continue;
    }

    if(npc.state==='idle'){
      if(now>=npc.stateUntil){
        if(Math.random()<0.48&&seatSlots.length&&reserveRandomSeat(npc)){
          // seat reserved; walk to it
        }else{
          npc.target=randomWalkTarget(npc);
          npc.state='walking';
          playNPC(npc,'Avatar_Walk');
        }
      }
      continue;
    }

    if(npc.state==='walking'||npc.state==='goingToSeat'){
      if(!npc.target){
        npc.state='idle';
        npc.stateUntil=now+2;
        playNPC(npc,'Avatar_Idle');
        continue;
      }

      const dir=npc.target.clone().sub(npc.root.position);
      dir.y=0;
      const distance=dir.length();

      if(distance<.10){
        if(npc.state==='goingToSeat'&&npc.seat){
          npc.root.position.copy(npc.seat.position);
          npc.root.rotation.y=Math.atan2(npc.seat.faceDir.x,npc.seat.faceDir.z)+MODEL_YAW_CORRECTION+SIT_YAW_CORRECTION;
          npc.state='seated';
          npc.stateUntil=now+THREE.MathUtils.randFloat(7,15);
          npc.target=null;
          playNPC(npc,npc.actions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit');
        }else{
          npc.state='idle';
          npc.stateUntil=now+THREE.MathUtils.randFloat(1.5,5.0);
          npc.target=null;
          playNPC(npc,'Avatar_Idle');
        }
        continue;
      }

      dir.normalize();
      const step=Math.min(npc.speed*dt,distance);
      const candidate=npc.root.position.clone().addScaledVector(dir,step);

      if(npcCandidateBlocked(npc,candidate)){
        if(npc.state==='goingToSeat'){
          // Give way briefly instead of abandoning a reserved seat.
          playNPC(npc,'Avatar_Idle');
        }else{
          npc.target=randomWalkTarget(npc);
        }
        continue;
      }

      npc.root.position.copy(candidate);
      npc.root.rotation.y=Math.atan2(dir.x,dir.z)+MODEL_YAW_CORRECTION;
      playNPC(npc,'Avatar_Walk');
    }
  }
}

function updateCamera(){
  if(!avatarRoot)return;

  const avatarFocus=new THREE.Vector3(
    avatarRoot.position.x,
    avatarRoot.position.y+1.45,
    avatarRoot.position.z
  );

  // Loose follow. Camera orientation never changes because of movement.
  const dx=avatarFocus.x-cameraFocus.x;
  const dz=avatarFocus.z-cameraFocus.z;
  const dist=Math.hypot(dx,dz);
  const DEAD_ZONE=1.45;

  if(dist>DEAD_ZONE){
    const excess=dist-DEAD_ZONE;
    cameraFocus.x += (dx/dist)*excess;
    cameraFocus.z += (dz/dist)*excess;
  }

  cameraFocus.y=1.45;
  camTarget.copy(cameraFocus);

  const horizontalDir=new THREE.Vector2(Math.sin(camYaw),Math.cos(camYaw)).normalize();

  const fx=camTarget.x, fz=camTarget.z;
  const dx2=horizontalDir.x, dz2=horizontalDir.y;
  const requestedHorizontal=Math.cos(camPitch)*camDistance;
  let horizontal=requestedHorizontal;

  if(Math.hypot(fx,fz)<=WALK_RADIUS+.4){
    // Inside the pavilion, keep the old camera safety circle.
    const b=2*(fx*dx2+fz*dz2);
    const cc=fx*fx+fz*fz-CAMERA_RADIUS*CAMERA_RADIUS;
    const disc=Math.max(0,b*b-4*cc);
    const maxHorizontal=(-b+Math.sqrt(disc))/2;
    horizontal=Math.max(.35,Math.min(requestedHorizontal,maxHorizontal-.08));
  }

  const desired=new THREE.Vector3(
    camTarget.x+dx2*horizontal,
    camTarget.y+Math.sin(camPitch)*camDistance,
    camTarget.z+dz2*horizontal
  );

  desired.y=THREE.MathUtils.clamp(desired.y,.85,5.2);

  camera.position.copy(desired);
  camera.lookAt(camTarget);
}

function tryClickWorkPrompt(){
  if(!playerSeat || !workPromptController.hitTest(raycaster))return false;
  openArtworkPickerForSeat(playerSeat);
  return true;
}

function tryPreviewClickedArtwork(){
  if(!furnitureScene)return false;
  const hits=raycaster.intersectObject(furnitureScene,true);
  for(const hit of hits){
    let seat=null;
    let p=hit.object;
    while(p){
      if(p.userData?.seatSlot){seat=p.userData.seatSlot;break;}
      p=p.parent;
    }
    if(!seat)continue;

    let q=hit.object;
    while(q){
      if(q.name==='Artwork Overlay'){
        return openArtworkPreview(seat);
      }
      q=q.parent;
    }
  }
  return false;
}

function setClickTarget(clientX,clientY){
  if(!avatarRoot)return;

  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((clientY-rect.top)/rect.height)*2+1;

  raycaster.setFromCamera(pointer,camera);

  // Prompt itself is clickable and opens the same upload picker.
  if(tryClickWorkPrompt())return;

  // Existing artwork can be opened large.
  if(tryPreviewClickedArtwork())return;

  // While seated, clicking the active canvas still opens artwork upload.
  if(tryOpenArtworkOnClickedCanvas())return;

  // Stool/easel gets priority over the floor: click either to walk there and sit.
  if(trySitOnClickedStool())return;

  const hit=new THREE.Vector3();
  if(!raycaster.ray.intersectPlane(groundPlane,hit))return;

  if(!isWalkableWorldPosition(hit)){
    showStatus('파빌리온, 다리 또는 건너편 부지를 클릭해 주세요');
    return;
  }

  if(isInsideCenterBlock(hit,.14)){
    showStatus('중앙 작업대는 지나갈 수 없어요');
    return;
  }

  releasePlayerSeat();
  moveTarget=new THREE.Vector3(hit.x,avatarRoot.position.y,hit.z);
  playAvatar('Avatar_Walk');
  showStatus('이동 중 → '+hit.x.toFixed(1)+', '+hit.z.toFixed(1));
}

renderer.domElement.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  pointerDown=true;
  dragged=false;
  downX=lastX=e.clientX;
  downY=lastY=e.clientY;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});

renderer.domElement.addEventListener('pointermove',e=>{
  if(!pointerDown)return;

  const total=Math.hypot(e.clientX-downX,e.clientY-downY);
  if(total>7)dragged=true;

  if(dragged){
    const dx=e.clientX-lastX;
    const dy=e.clientY-lastY;
    camYaw-=dx*.006;
    camPitch=THREE.MathUtils.clamp(camPitch+dy*.004,-.18,.92);
  }

  lastX=e.clientX;
  lastY=e.clientY;
});

renderer.domElement.addEventListener('pointerup',e=>{
  if(e.button!==0)return;

  if(pointerDown&&!dragged){
    setClickTarget(e.clientX,e.clientY);
  }

  pointerDown=false;
  renderer.domElement.releasePointerCapture?.(e.pointerId);
});

renderer.domElement.addEventListener('wheel',e=>{
  e.preventDefault();
  camDistance=THREE.MathUtils.clamp(camDistance+e.deltaY*.006,4.6,7.8);
  // Keep the lens fixed so wheel zoom does not reintroduce a wide-angle look.
},{passive:false});

addEventListener('keydown',e=>{
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){
    keys.add(e.code);
    e.preventDefault();
  }
});
addEventListener('keyup',e=>keys.delete(e.code));

function updateWorkTimer(dt){
  if(playerSeat){
    workElapsedSeconds+=dt;
    totalWorkElapsedSeconds+=dt;
    currentWorkElapsedSeconds+=dt;
    workSaveAccumulator+=dt;
    dailyWorkSyncAccumulator+=dt;
    if(workSaveAccumulator>=5){
      workSaveAccumulator=0;
      saveProgress();
    }
    if(dailyWorkSyncAccumulator>=10){
      dailyWorkSyncAccumulator=0;
      syncDailyWorkToServer();
      if(activeWorkId){
        supabase.from('atelier_works')
          .update({total_work_seconds:Math.floor(currentWorkElapsedSeconds)})
          .eq('id',activeWorkId)
          .eq('owner_id',ownerId);
      }
    }
  }

  const timeText=formatTodayWork(workElapsedSeconds);
  workTimer.textContent=playerSeat
    ? t(`그림 그리는 중 · 오늘 ${timeText}`,`Painting · today ${timeText}`)
    : t(`오늘 ${timeText} 그림 그렸어요`,`Today · ${timeText} painting`);
}

function updateMovement(dt){
  if(!avatarRoot)return;
  if(localGreetingUntil>performance.now()){
    broadcastMotion();
    return;
  }

  const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
  const s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);

  const dir=new THREE.Vector3();
  let manual=!!(f||s);

  if(manual){
    releasePlayerSeat();
    moveTarget=null;

    // Camera-relative controls from the ACTUAL rendered camera.
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y=0;
    forward.normalize();

    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();

    dir.addScaledVector(forward,f);
    dir.addScaledVector(right,s);
    if(dir.lengthSq()>0)dir.normalize();
  }else if(moveTarget){
    dir.copy(moveTarget).sub(avatarRoot.position);
    dir.y=0;

    const distance=dir.length();
    if(distance<.09){
      avatarRoot.position.x=moveTarget.x;
      avatarRoot.position.z=moveTarget.z;
      moveTarget=null;

      if(pendingPlayerSeat){
        playerSeat=pendingPlayerSeat;
        pendingPlayerSeat=null;
        mySeat=playerSeat;
        recolorBeret(avatarModel,hatColorForSeatIndex(playerSeat.index));
        avatarRoot.rotation.y=
          Math.atan2(playerSeat.faceDir.x,playerSeat.faceDir.z)+MODEL_YAW_CORRECTION+SIT_YAW_CORRECTION;
        playAvatar(avatarActions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit');
        showStatus('내 이젤에서 작업 중 · 일어나면 타이머 일시정지');
        broadcastMotion(true);
      }else{
        playAvatar('Avatar_Idle');
      }
      return;
    }

    dir.normalize();
  }else{
    if(playerSeat){
      const seatedAction=avatarActions['Avatar_Paint']||avatarActions['Avatar_Sit'];
      if(currentAction!==seatedAction)playAvatar(avatarActions['Avatar_Paint']?'Avatar_Paint':'Avatar_Sit');
      broadcastMotion();
      return;
    }
    if(currentAction===avatarActions['Avatar_Walk'])playAvatar('Avatar_Idle');
    broadcastMotion();
    return;
  }

  setAvatarFacing(dir);

  let step=MOVE_SPEED*dt;
  if(moveTarget){
    const remaining=avatarRoot.position.distanceTo(moveTarget);
    step=Math.min(step,remaining);
  }

  let next=avatarRoot.position.clone().addScaledVector(dir,step);
  next=constrainWalkable(next,avatarRoot.position);

  // Do not let the player walk through residents.
  if(playerCandidateBlocked(next)){
    if(moveTarget)moveTarget=null;
    playAvatar('Avatar_Idle');
    return;
  }

  avatarRoot.position.copy(next);
  playAvatar('Avatar_Walk');
  broadcastMotion();
}

function hideEmbeddedRiggedCharacters(root){
  if(!root)return;
  const hideRoots=new Set();

  root.traverse(o=>{
    if(!o.isSkinnedMesh)return;
    let p=o;
    while(p.parent && p.parent!==root)p=p.parent;
    hideRoots.add(p);
  });

  for(const node of hideRoots){
    node.visible=false;
    node.userData.hiddenEmbeddedCharacter=true;
  }
}

function normalizedAssetName(name){
  return (name||'')
    .toLowerCase()
    .replace(/\.\d{3}$/,'')
    .replace(/[_\-\s]+/g,' ')
    .trim();
}

function hideAvatarLikeMeshes(root,avatarSource){
  if(!root || !avatarSource)return;

  const avatarMeshNames=new Set();
  const avatarGeometryNames=new Set();

  avatarSource.traverse(o=>{
    if(!o.isMesh && !o.isSkinnedMesh)return;
    const on=normalizedAssetName(o.name);
    const gn=normalizedAssetName(o.geometry?.name);
    if(on)avatarMeshNames.add(on);
    if(gn)avatarGeometryNames.add(gn);
  });

  root.traverse(o=>{
    if(!o.isMesh && !o.isSkinnedMesh)return;

    const on=normalizedAssetName(o.name);
    const gn=normalizedAssetName(o.geometry?.name);

    const nameMatch=(on && avatarMeshNames.has(on));
    const geometryMatch=(gn && avatarGeometryNames.has(gn));

    if(nameMatch || geometryMatch){
      o.visible=false;
      o.userData.hiddenAvatarDuplicate=true;
    }
  });
}

loadProgress();

function stripEmbeddedBoatFromExternalEnvironment(extGLB){
  if(!extGLB?.scene)return;

  const boatRoots=[];
  extGLB.scene.traverse(o=>{
    const n=(o.name||'').toLowerCase();
    if(n.includes('boat'))boatRoots.push(o);
  });

  for(const root of boatRoots){
    root.traverse(o=>{o.visible=false;});
  }

  if(Array.isArray(extGLB.animations)){
    extGLB.animations=extGLB.animations
      .map(clip=>{
        const tracks=clip.tracks.filter(track=>!(track.name||'').toLowerCase().includes('boat'));
        if(!tracks.length)return null;
        const clean=clip.clone();
        clean.tracks=tracks;
        clean.resetDuration();
        return clean;
      })
      .filter(Boolean);
  }
}

Promise.all([
  loadGLB('./models/atelier_environment_web.glb'),
  loadGLB('./models/avatar_01.glb'),
  loadOptionalGLB('./models/atelier_furniture.glb'),
  loadOptionalGLB('./models/atelier_upper_lower_flower.glb'),
  loadOptionalGLB('./models/flower_light.glb'),
  loadOptionalGLB('./models/atelier_boat.glb'),
  loadOptionalGLB('./models/atelier_environment_ext_web.glb')
]).then(async ([envGLB,avGLB,furnitureGLB,flowerGLB,flowerLightGLB,boatGLB,extEnvGLB])=>{
  // Non-avatar GLBs must never contribute character meshes.
  // Catch both rigged duplicates and meshes accidentally exported as ordinary geometry.
  hideEmbeddedRiggedCharacters(envGLB?.scene);
  hideEmbeddedRiggedCharacters(furnitureGLB?.scene);
  hideEmbeddedRiggedCharacters(flowerGLB?.scene);
  hideEmbeddedRiggedCharacters(flowerLightGLB?.scene);
  hideEmbeddedRiggedCharacters(boatGLB?.scene);
  hideEmbeddedRiggedCharacters(extEnvGLB?.scene);

  hideAvatarLikeMeshes(envGLB?.scene,avGLB?.scene);
  hideAvatarLikeMeshes(furnitureGLB?.scene,avGLB?.scene);
  hideAvatarLikeMeshes(flowerGLB?.scene,avGLB?.scene);
  hideAvatarLikeMeshes(flowerLightGLB?.scene,avGLB?.scene);
  hideAvatarLikeMeshes(boatGLB?.scene,avGLB?.scene);
  hideAvatarLikeMeshes(extEnvGLB?.scene,avGLB?.scene);

  // Hide stale decor/furniture baked into the environment.
  // Dedicated GLBs below are now the single source of truth.
  envGLB.scene.traverse(o=>{
    const n=(o.name||'').toLowerCase();
    if(
      n.includes('boat') ||
      n.includes('easel') ||
      n.includes('stool') ||
      n.includes('upper flower') ||
      n.includes('lower flower')
    ){
      o.visible=false;
    }
  });
  enhanceMaterials(envGLB.scene);
  scene.add(envGLB.scene);

  if(extEnvGLB){
    stripEmbeddedBoatFromExternalEnvironment(extEnvGLB);
    enhanceMaterials(extEnvGLB.scene);
    scene.add(extEnvGLB.scene);

    if(extEnvGLB.animations?.length){
      extEnvMixer=new THREE.AnimationMixer(extEnvGLB.scene);
      extEnvGLB.animations.forEach(clip=>{
        const action=extEnvMixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat,Infinity);
        action.play();
      });
    }
  }

  if(envGLB.animations?.length){
    envMixer=new THREE.AnimationMixer(envGLB.scene);
    envGLB.animations.forEach(clip=>{
      const a=envMixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat,Infinity);
      a.play();
    });
  }

  if(furnitureGLB){
    furnitureScene=furnitureGLB.scene;
    repairFurnitureExport(furnitureGLB.scene);
    keepOnlyFurniture(furnitureGLB.scene);
    enhanceMaterials(furnitureGLB.scene);
    forceEaselWoodMaterials(furnitureGLB.scene);
    forceEaselTopClampsByGeometry(furnitureGLB.scene);
    forceNamedClampMaterials(furnitureGLB.scene);
    logEaselClampDiagnostics(furnitureGLB.scene);

    scene.add(furnitureGLB.scene);
    keepFurnitureInsidePavilion(furnitureGLB.scene);
  }

  if(flowerGLB){
    keepOnlyFlowers(flowerGLB.scene);
    enhanceMaterials(flowerGLB.scene);
    scene.add(flowerGLB.scene);
  }

  // Some older flower_light.glb exports contain the avatar instead of lights.
  // Only attach the file if it truly contains flower-light objects.
  let flowerLightRoot=null;
  if(flowerLightGLB){
    let hasFlowerLight=false;
    flowerLightGLB.scene.traverse(o=>{
      if(normalizedAssetName(o.name).startsWith('flower light'))hasFlowerLight=true;
    });
    if(hasFlowerLight){
      enhanceMaterials(flowerLightGLB.scene);
      scene.add(flowerLightGLB.scene);
      flowerLightRoot=flowerLightGLB.scene;
    }else{
      console.warn('[ATELIER] flower_light.glb has no flower lights; use lower flowers for glow');
    }
  }

  registerNightWindows(scene);
  registerFlowerNightLights(flowerLightRoot,flowerGLB?.scene||envGLB.scene);
  updateDayNightLighting(true);

  createBridgeAndGalleryLot();
  createAtmosphericClouds();
  createSnowSystem();

  if(boatGLB){
    enhanceMaterials(boatGLB.scene);
    boatGLB.scene.traverse(o=>{o.visible=true;});
    scene.add(boatGLB.scene);

    // Blender is the single source of truth for boat size, position, facing, path and timing.
    if(boatGLB.animations?.length){
      boatMixer=new THREE.AnimationMixer(boatGLB.scene);
      boatGLB.animations.forEach(clip=>{
        const action=boatMixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat,Infinity);
        action.setEffectiveTimeScale(.35);
        action.reset().play();
      });
    }else{
      boatMixer=null;
      console.warn('atelier_boat.glb has no animation clips.');
    }
  }

  // Outer transform group controls movement/facing.
  avatarRoot=new THREE.Group();
  avatarRoot.position.set(0,0,-2.35);
  scene.add(avatarRoot);

  avatarModel=avGLB.scene;
  isolateAvatarMaterials(avatarModel);
  enhanceMaterials(avatarModel);
  avatarRoot.add(avatarModel);
  normalizeAvatarOrigin(avatarModel);
  setAvatarNameLabel(avatarRoot,displayName);
  const ownNameLabel=avatarRoot.getObjectByName('Player Name Label');
  if(ownNameLabel)ownNameLabel.visible=true;

  avatarMixer=new THREE.AnimationMixer(avatarModel);
  window.__atelierAvatarClips=avGLB.animations;
  avGLB.animations.forEach(clip=>{
    avatarActions[clip.name]=avatarMixer.clipAction(clip);
  });

  recolorBeret(avatarModel,standingPlayerHatColor());
  playAvatar('Avatar_Idle',0);

  // Build real stool seat anchors from the uploaded furniture GLB,
  // then create independent residents from the same rigged avatar.
  if(furnitureGLB){
    collectSeatSlots(furnitureGLB.scene);
    applySavedArtworkLock();
  }
  spawnNPCs(avatarModel,avGLB.animations,NPC_COUNT);
  restoreSavedArtwork();
  await fetchServerState();
  startRealtimeSync();
  heartbeatTimer=setInterval(serverHeartbeat,HEARTBEAT_MS);
  presencePulseTimer=setInterval(serverPresencePulse,PRESENCE_PULSE_MS);
  presencePollTimer=setInterval(fetchPresenceOnly,PRESENCE_POLL_MS);
  serverPresencePulse();
  fetchPresenceOnly();
  await refreshAuthSession();
  syncDailyWorkToServer();

  cameraFocus.set(
    avatarRoot.position.x,
    avatarRoot.position.y+1.45,
    avatarRoot.position.z
  );
  camTarget.copy(cameraFocus);
  updateCamera();

  clearInterval(loadingCopyTimer);
  loading.style.display='none';
}).catch(err=>{
  console.error(err);
  clearInterval(loadingCopyTimer);
  loadingMessage.textContent=t('화실을 불러오지 못했어요','Could not load the atelier');
  loadingMessage.classList.remove('swap');
  showStatus(String(err));
});

function createBridgeAndGalleryLot(){
  const bridgeGroup=new THREE.Group();
  bridgeGroup.name='Gallery Bridge Prototype';
  bridgeGroup.position.set(BRIDGE_OFFSET_X,0,BRIDGE_OFFSET_Z);
  bridgeGroup.rotation.y=BRIDGE_ANGLE;

  const woodMat=new THREE.MeshStandardMaterial({
    color:0x9c6a3d,
    roughness:.88,
    metalness:0
  });
  const railMat=new THREE.MeshStandardMaterial({
    color:0x7d5332,
    roughness:.92,
    metalness:0
  });
  const stoneMat=new THREE.MeshStandardMaterial({
    color:0xc8bca9,
    roughness:.96,
    metalness:0
  });

  const bridgeLength=BRIDGE_END_Z-BRIDGE_START_Z;
  const bridgeMidZ=(BRIDGE_START_Z+BRIDGE_END_Z)/2;

  // Main deck
  const deck=new THREE.Mesh(
    new THREE.BoxGeometry(BRIDGE_HALF_WIDTH*2,0.18,bridgeLength),
    woodMat
  );
  deck.position.set(0,-.02,bridgeMidZ);
  deck.receiveShadow=true;
  deck.castShadow=true;
  bridgeGroup.add(deck);

  // Slats make the direction/readability obvious.
  const slatGeo=new THREE.BoxGeometry(BRIDGE_HALF_WIDTH*2-.08,.06,.12);
  for(let z=BRIDGE_START_Z+.25;z<BRIDGE_END_Z-.15;z+=.38){
    const slat=new THREE.Mesh(slatGeo,railMat);
    slat.position.set(0,.10,z);
    slat.castShadow=true;
    bridgeGroup.add(slat);
  }

  // Simple rails
  const railGeo=new THREE.BoxGeometry(.09,.10,bridgeLength);
  for(const x of [-BRIDGE_HALF_WIDTH+.08,BRIDGE_HALF_WIDTH-.08]){
    const rail=new THREE.Mesh(railGeo,railMat);
    rail.position.set(x,.72,bridgeMidZ);
    bridgeGroup.add(rail);

    for(let z=BRIDGE_START_Z+.25;z<=BRIDGE_END_Z-.2;z+=1.1){
      const post=new THREE.Mesh(new THREE.BoxGeometry(.10,1.25,.10),railMat);
      post.position.set(x,.35,z);
      bridgeGroup.add(post);
    }
  }

  // Future gallery buildable lot.
  const lot=new THREE.Mesh(
    new THREE.CylinderGeometry(5.8,5.8,.22,48),
    stoneMat
  );
  lot.position.set(0,-.03,GALLERY_CENTER_Z);
  lot.receiveShadow=true;
  bridgeGroup.add(lot);

  // Small marker so the destination is understandable before the gallery exists.
  const signPost=new THREE.Mesh(new THREE.BoxGeometry(.12,1.45,.12),railMat);
  signPost.position.set(-2.8,.62,GALLERY_CENTER_Z-1.1);
  bridgeGroup.add(signPost);

  const signCanvas=document.createElement('canvas');
  signCanvas.width=512;
  signCanvas.height=180;
  const ctx=signCanvas.getContext('2d');
  ctx.fillStyle='rgba(247,243,237,.96)';
  ctx.fillRect(0,0,512,180);
  ctx.fillStyle='#4b3a30';
  ctx.font='700 46px sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText('전시관 예정지',256,90);
  const signTex=new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(
    new THREE.PlaneGeometry(2.55,.9),
    new THREE.MeshBasicMaterial({map:signTex,transparent:true,side:THREE.DoubleSide})
  );
  sign.position.set(-2.8,1.45,GALLERY_CENTER_Z-1.1);
  sign.rotation.y=Math.PI;
  bridgeGroup.add(sign);

  scene.add(bridgeGroup);
}

function chooseSnowCloud(){
  if(!skyClouds.length)return null;
  return skyClouds[Math.floor(Math.random()*skyClouds.length)];
}

function snowSpawnFromCloud(i,initial=false){
  const cloud=chooseSnowCloud();
  if(!cloud)return null;

  cloud.updateMatrixWorld(true);
  const cpos=cloud.getWorldPosition(new THREE.Vector3());
  const spread=1.7+Math.random()*1.8;

  const x=cpos.x+(Math.random()-.5)*spread*2;
  const z=cpos.z+(Math.random()-.5)*spread*2;

  // New flakes originate just under the cloud.
  // Initial fill distributes some flakes lower so snow is already visible immediately.
  const y=initial
    ? THREE.MathUtils.lerp(.35,cpos.y-.35,Math.random())
    : cpos.y-.25-Math.random()*.45;

  return {x,y,z,cloud};
}

function createSnowSystem(){
  const geometry=new THREE.BufferGeometry();
  snowPositions=new Float32Array(SNOW_COUNT*3);
  snowVelocities=new Float32Array(SNOW_COUNT*2);

  for(let i=0;i<SNOW_COUNT;i++){
    const j=i*3;
    const spawn=snowSpawnFromCloud(i,true);
    if(spawn){
      snowPositions[j]=spawn.x;
      snowPositions[j+1]=spawn.y;
      snowPositions[j+2]=spawn.z;
    }else{
      snowPositions[j]=(Math.random()-.5)*30;
      snowPositions[j+1]=Math.random()*10+2;
      snowPositions[j+2]=(Math.random()-.5)*30;
    }

    const k=i*2;
    snowVelocities[k]=.38+Math.random()*.62;
    snowVelocities[k+1]=(.03+Math.random()*.16)*(Math.random()<.5?-1:1);
  }

  geometry.setAttribute('position',new THREE.BufferAttribute(snowPositions,3));

  const material=new THREE.PointsMaterial({
    color:0xffffff,
    size:.075,
    transparent:true,
    opacity:.58,
    depthWrite:false,
    sizeAttenuation:true
  });

  snowSystem=new THREE.Points(geometry,material);
  snowSystem.name='Atelier Snow';
  snowSystem.frustumCulled=false;
  scene.add(snowSystem);
}

function updateSnow(dt){
  if(!snowSystem || !snowEnabled)return;

  const pos=snowSystem.geometry.attributes.position.array;
  const windX=.10;

  for(let i=0;i<SNOW_COUNT;i++){
    const j=i*3;
    const k=i*2;

    pos[j]+= (windX+snowVelocities[k+1]) * dt;
    pos[j+1]-= snowVelocities[k] * dt;
    pos[j+2]+= Math.sin((performance.now()*.0005)+(i*.37))*.018*dt;

    if(pos[j+1]<-.15 || pos[j]>18 || pos[j]<-18 || pos[j+2]>18 || pos[j+2]<-18){
      const spawn=snowSpawnFromCloud(i,false);
      if(spawn){
        pos[j]=spawn.x;
        pos[j+1]=spawn.y;
        pos[j+2]=spawn.z;
      }
    }
  }

  snowSystem.geometry.attributes.position.needsUpdate=true;
}

function makeCloudPuffTexture(){
  const c=document.createElement('canvas');
  c.width=256;
  c.height=256;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(128,128,20,128,128,118);
  g.addColorStop(0,'rgba(255,255,255,1)');
  g.addColorStop(.55,'rgba(255,255,255,.92)');
  g.addColorStop(.82,'rgba(255,255,255,.58)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,256,256);

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

function createCloudGroup(puffTexture,scale=1){
  const group=new THREE.Group();
  const puffMat=new THREE.SpriteMaterial({
    map:puffTexture,
    transparent:true,
    depthWrite:false,
    depthTest:true,
    opacity:.98,
    color:0xffffff
  });

  const puffs=[
    [-1.25,-.05,1.35],
    [-.65,.28,1.7],
    [0,.42,1.95],
    [.72,.25,1.62],
    [1.3,-.08,1.25],
    [-.35,-.18,1.55],
    [.42,-.20,1.5]
  ];

  for(const [x,y,s] of puffs){
    const puff=new THREE.Sprite(puffMat.clone());
    puff.position.set(x*scale,y*scale,0);
    puff.scale.set(s*scale,s*.72*scale,1);
    group.add(puff);
  }
  return group;
}

function makeCloudReflectionTexture(){
  const c=document.createElement('canvas');
  c.width=512;
  c.height=256;
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);

  const blobs=[
    [90,150,70,46],
    [155,125,92,58],
    [245,112,118,68],
    [335,128,95,58],
    [420,154,70,43],
    [255,166,145,54]
  ];

  for(const [x,y,rx,ry] of blobs){
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(1,ry/rx);
    const g=ctx.createRadialGradient(0,0,rx*.15,0,0,rx);
    g.addColorStop(0,'rgba(220,239,246,.48)');
    g.addColorStop(.55,'rgba(205,229,238,.34)');
    g.addColorStop(1,'rgba(190,218,229,0)');
    ctx.fillStyle=g;
    ctx.beginPath();
    ctx.arc(0,0,rx,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

function createAtmosphericClouds(){
  const tex=makeCloudPuffTexture();

  const configs=[
    {a:.08,r:14.2,y:5.5,s:1.75,speed:.025},
    {a:.58,r:16.0,y:6.2,s:1.55,speed:.020},
    {a:1.05,r:15.0,y:5.9,s:2.05,speed:.018},
    {a:1.48,r:17.0,y:6.8,s:1.65,speed:.016},
    {a:1.95,r:14.8,y:5.6,s:1.70,speed:.022},
    {a:2.38,r:16.5,y:6.3,s:2.10,speed:.015},
    {a:2.90,r:15.2,y:7.3,s:1.55,speed:.017},
    {a:3.35,r:17.2,y:7.8,s:1.85,speed:.014},
    {a:3.82,r:14.5,y:6.9,s:1.60,speed:.019},
    {a:4.26,r:16.1,y:8.2,s:1.95,speed:.013},
    {a:4.78,r:15.0,y:7.4,s:1.50,speed:.018},
    {a:5.25,r:17.0,y:6.7,s:1.80,speed:.016},
    {a:5.72,r:14.6,y:5.8,s:1.65,speed:.021}
  ];

  for(const cfg of configs){
    const cloud=createCloudGroup(tex,cfg.s);
    cloud.position.set(Math.cos(cfg.a)*cfg.r,cfg.y,Math.sin(cfg.a)*cfg.r);
    cloud.userData.angle=cfg.a;
    cloud.userData.radius=cfg.r;
    cloud.userData.speed=cfg.speed;
    scene.add(cloud);
    skyClouds.push(cloud);

    // Horizontal water reflection: wide, soft and visibly cloud-shaped.
    const reflectionTex=makeCloudReflectionTexture();
    const reflectionMat=new THREE.MeshBasicMaterial({
      map:reflectionTex,
      transparent:true,
      opacity:.58,
      depthWrite:false,
      side:THREE.DoubleSide,
      color:0xd5edf4
    });
    const reflection=new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.s*5.6,cfg.s*2.25),
      reflectionMat
    );
    reflection.rotation.x=-Math.PI/2;
    reflection.position.set(
      Math.cos(cfg.a)*cfg.r,
      -.58,
      Math.sin(cfg.a)*cfg.r
    );
    reflection.userData.angle=cfg.a;
    reflection.userData.radius=cfg.r;
    reflection.userData.speed=cfg.speed*.9;
    scene.add(reflection);
    waterCloudReflections.push(reflection);
  }
}

function updateAtmosphericClouds(dt){
  for(const cloud of skyClouds){
    cloud.userData.angle=(cloud.userData.angle+cloud.userData.speed*dt)%(Math.PI*2);
    const a=cloud.userData.angle;
    const r=cloud.userData.radius;
    cloud.position.x=Math.cos(a)*r;
    cloud.position.z=Math.sin(a)*r;
  }

  for(const reflection of waterCloudReflections){
    reflection.userData.angle=(reflection.userData.angle+reflection.userData.speed*dt)%(Math.PI*2);
    const a=reflection.userData.angle;
    const r=reflection.userData.radius;
    reflection.position.x=Math.cos(a)*r;
    reflection.position.z=Math.sin(a)*r;
  }
}


function updateBoatMotion(dt){
  // Blender owns both route and orientation. Web only controls playback speed.
  if(boatMixer)boatMixer.update(dt);
}

function tick(){
  requestAnimationFrame(tick);

  const dt=Math.min(clock.getDelta(),.05);

  if(avatarMixer)avatarMixer.update(dt);
  remoteAvatars.forEach(entry=>entry.mixer?.update(dt));
  updateRemoteMotion(dt);
  updateProximityNameLabels();

  if(npcs.length)updateNPCs(dt,performance.now()/1000);
  if(envMixer)envMixer.update(dt);
  if(extEnvMixer)extEnvMixer.update(dt);
  updateBoatMotion(dt);
  updateAtmosphericClouds(dt);
  updateSnow(dt);
  updateDayNightLighting();
  updateStarTwinkle(performance.now());

  // Animate only known water materials; avoid traversing the entire scene every frame.
  const rippleNow=performance.now();
  for(const waterMaterial of animatedWaterMaterials){
    if(!waterMaterial?.normalMap)continue;
    waterMaterial.normalMap.offset.x=(waterMaterial.normalMap.offset.x+dt*0.075)%1;
    waterMaterial.normalMap.offset.y=(waterMaterial.normalMap.offset.y+dt*0.042)%1;
    waterMaterial.normalScale.set(
      1.22+Math.sin(rippleNow*0.0017)*0.14,
      1.10+Math.cos(rippleNow*0.0013)*0.14
    );
    waterMaterial.clearcoatRoughness=
      0.035+Math.sin(rippleNow*0.0015)*0.01;
  }

  updateWorkTimer(dt);
  updateArtworkLocks();
  workPromptController.update({
    playerSeat,
    playerArtworkSeat,
    blockedPromptSeat,
    blockedPromptUntil,
    isArtworkLocked,
    blockedEaselPrompts,
    workPrompts:WORK_PROMPTS
  });
  updateMovement(dt);
  updateCamera();

  renderer.render(scene,camera);
}
tick();

addEventListener('beforeunload',()=>{
  saveProgress();
  syncDailyWorkToServer();
  deletePresence(supabase,clientId);
  if(playerSeat){
    navigator.sendBeacon?.(
      SUPABASE_URL+'/rest/v1/rpc/atelier_release_easel',
      new Blob([JSON.stringify({p_seat_index:playerSeat.index,p_client_id:clientId})],{type:'application/json'})
    );
  }
});

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
