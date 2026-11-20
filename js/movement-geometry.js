import * as THREE from 'three';

export function toBridgeLocal(v,config){
  const px=v.x-config.bridgeOffsetX;
  const pz=v.z-config.bridgeOffsetZ;
  const c=Math.cos(-config.bridgeAngle);
  const sn=Math.sin(-config.bridgeAngle);
  return {x:px*c-pz*sn,z:px*sn+pz*c};
}

export function isWalkableWorldPosition(v,config){
  const inPavilion=Math.hypot(v.x,v.z)<=config.walkRadius;
  const p=toBridgeLocal(v,config);
  const onBridge=
    Math.abs(p.x)<=config.bridgeHalfWidth &&
    p.z>=config.bridgeStartZ &&
    p.z<=config.bridgeEndZ;
  const onGalleryGround=
    Math.abs(p.x)<=config.galleryHalfWidth &&
    p.z>=config.galleryCenterZ-config.galleryHalfDepth &&
    p.z<=config.galleryCenterZ+config.galleryHalfDepth;
  return inPavilion || onBridge || onGalleryGround;
}

export function constrainWalkable(next,previous,config){
  return isWalkableWorldPosition(next,config)?next:previous.clone();
}

export function facingYaw(dir,modelYawCorrection){
  return Math.atan2(dir.x,dir.z)+modelYawCorrection;
}
