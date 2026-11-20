import * as THREE from 'three';

export function makeContainedArtworkTexture(img,aspect){
  const texW=1024;
  const texH=Math.max(256,Math.round(texW/Math.max(.2,Math.min(5,aspect))));
  const c=document.createElement('canvas');
  c.width=texW;
  c.height=texH;
  const ctx=c.getContext('2d');
  const iw=img.naturalWidth||img.width;
  const ih=img.naturalHeight||img.height;
  const scale=Math.max(texW/iw,texH/ih);
  const drawW=iw*scale;
  const drawH=ih*scale;
  ctx.drawImage(img,(texW-drawW)/2,(texH-drawH)/2,drawW,drawH);

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.needsUpdate=true;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

export function makeArtworkOverlay(mesh,img,seat){
  mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox.clone();
  const size=box.getSize(new THREE.Vector3());
  const center=box.getCenter(new THREE.Vector3());
  const dims=[
    {axis:'x',v:size.x},{axis:'y',v:size.y},{axis:'z',v:size.z}
  ].sort((a,b)=>a.v-b.v);

  const thin=dims[0].axis;
  let width,height,rot=new THREE.Euler();
  let plus=center.clone(),minus=center.clone();
  const eps=.018;

  if(thin==='z'){
    width=size.x;height=size.y;plus.z=box.max.z+eps;minus.z=box.min.z-eps;
  }else if(thin==='x'){
    width=size.z;height=size.y;rot.y=Math.PI/2;plus.x=box.max.x+eps;minus.x=box.min.x-eps;
  }else{
    width=size.x;height=size.z;rot.x=-Math.PI/2;plus.y=box.max.y+eps;minus.y=box.min.y-eps;
  }

  mesh.updateWorldMatrix(true,false);
  const plusWorld=mesh.localToWorld(plus.clone());
  const minusWorld=mesh.localToWorld(minus.clone());
  const seatWorld=seat.position.clone();
  const usePlus=plusWorld.distanceToSquared(seatWorld)<=minusWorld.distanceToSquared(seatWorld);
  const localPos=usePlus?plus:minus;

  if(!usePlus){
    if(thin==='z')rot.y=Math.PI;
    else if(thin==='x')rot.y=-Math.PI/2;
    else rot.x=Math.PI/2;
  }

  const aspect=width/Math.max(height,.001);
  const tex=makeContainedArtworkTexture(img,aspect);
  const mat=new THREE.MeshBasicMaterial({
    map:tex,side:THREE.DoubleSide,toneMapped:false,transparent:false,
    depthTest:true,depthWrite:false,polygonOffset:true,
    polygonOffsetFactor:-4,polygonOffsetUnits:-4
  });
  const overlay=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);
  overlay.name='Artwork Overlay';
  overlay.position.copy(localPos);
  overlay.rotation.copy(rot);
  overlay.renderOrder=30;

  const old=mesh.getObjectByName('Artwork Overlay');
  if(old){
    old.geometry?.dispose?.();
    old.material?.map?.dispose?.();
    old.material?.dispose?.();
    mesh.remove(old);
  }
  mesh.add(overlay);
  return overlay;
}
