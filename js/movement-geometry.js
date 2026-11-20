import * as THREE from 'three';

export function toBridgeLocal(v,config){
  const px=v.x-config.bridgeOffsetX;
  const pz=v.z-config.bridgeOffsetZ;
  const c=Math.cos(-config.bridgeAngle);
  const sn=Math.sin(-config.bridgeAngle);
  return {x:px*c-pz*sn,z:px*sn+pz*c};
}

export function bridgeLocalToWorld(x,z,config,y=0){
  const c=Math.cos(config.bridgeAngle);
  const sn=Math.sin(config.bridgeAngle);
  return new THREE.Vector3(
    config.bridgeOffsetX + x*c - z*sn,
    y,
    config.bridgeOffsetZ + x*sn + z*c
  );
}

export function walkableZone(v,config){
  const inPavilion=Math.hypot(v.x,v.z)<=config.walkRadius;
  const p=toBridgeLocal(v,config);
  const onBridge=
    Math.abs(p.x)<=config.bridgeHalfWidth &&
    p.z>=config.bridgeStartZ &&
    p.z<=config.bridgeEndZ;
  const onGallery=
    Math.abs(p.x)<=config.galleryHalfWidth &&
    p.z>=config.galleryCenterZ-config.galleryHalfDepth &&
    p.z<=config.galleryCenterZ+config.galleryHalfDepth;
  if(onBridge)return 'bridge';
  if(onGallery)return 'gallery';
  if(inPavilion)return 'pavilion';
  return 'outside';
}

export function isWalkableWorldPosition(v,config){
  return walkableZone(v,config)!=='outside';
}

export function constrainWalkable(next,previous,config){
  return isWalkableWorldPosition(next,config)?next:previous.clone();
}

export function facingYaw(dir,modelYawCorrection){
  return Math.atan2(dir.x,dir.z)+modelYawCorrection;
}
