import * as THREE from 'three';

export function normalizeAvatarOrigin(model){
  model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model);
  const center=box.getCenter(new THREE.Vector3());
  const min=box.min.clone();
  model.position.x-=center.x;
  model.position.z-=center.z;
  model.position.y-=min.y;
  model.updateMatrixWorld(true);
}

export function isolateAvatarMaterials(model){
  if(!model)return;
  model.traverse(o=>{
    if(!o.isMesh || !o.material)return;
    if(Array.isArray(o.material))o.material=o.material.map(mat=>mat?.clone?.()||mat);
    else o.material=o.material.clone?.()||o.material;
  });
}

export function recolorBeret(model,color){
  if(!model)return;
  model.updateMatrixWorld(true);

  const whole=new THREE.Box3().setFromObject(model);
  const wholeSize=whole.getSize(new THREE.Vector3());
  const topCut=whole.min.y+wholeSize.y*.68;
  const tokenMatch=value=>{
    const v=(value||'').toLowerCase();
    return /(^|[\s_.-])(beret|hat)([\s_.-]|$)/.test(v);
  };
  const lum=mat=>{
    if(!mat?.color)return 1;
    return (mat.color.r+mat.color.g+mat.color.b)/3;
  };
  const parts=[];

  model.traverse(o=>{
    if(!o.isMesh || !o.material)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    const box=new THREE.Box3().setFromObject(o);
    const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    mats.forEach((mat,index)=>{
      if(!mat)return;
      const explicit=tokenMatch(o.name)||tokenMatch(mat.name);
      const dark=lum(mat)<.32;
      if(!explicit && !(dark && center.y>=topCut))return;
      const width=Math.max(size.x,size.z);
      const flatness=width/Math.max(size.y,.001);
      parts.push({o,index,mat,center,size,width,flatness,explicit,dark});
    });
  });

  if(!parts.length)return;
  const bodies=parts.filter(p=>p.explicit || (p.flatness>=1.35 && p.width>=wholeSize.y*.08));
  const body=(bodies.length?bodies:parts).sort((a,b)=>{
    if(a.explicit!==b.explicit)return Number(b.explicit)-Number(a.explicit);
    return (b.width*b.flatness)-(a.width*a.flatness);
  })[0];

  const bodyRadius=Math.max(body.size.x,body.size.z)*.72;
  const targets=parts.filter(p=>{
    if(p===body || p.explicit)return true;
    const dx=p.center.x-body.center.x;
    const dz=p.center.z-body.center.z;
    const horizontal=Math.hypot(dx,dz);
    const vertical=p.center.y-body.center.y;
    return p.dark &&
      horizontal<=bodyRadius &&
      vertical>=-body.size.y*.35 &&
      vertical<=body.size.y*2.8 &&
      p.width<=Math.max(body.width*1.15,wholeSize.y*.16);
  });

  const unique=new Map();
  for(const p of targets)unique.set(p.o.uuid+'|'+p.index,p);
  const targetColor=color?.isColor?color:new THREE.Color(color);

  for(const p of unique.values()){
    const cloned=p.mat.clone();
    if(cloned.color)cloned.color.copy(targetColor);
    if('map' in cloned)cloned.map=null;
    if('vertexColors' in cloned)cloned.vertexColors=false;
    if('roughness' in cloned)cloned.roughness=.68;
    if('metalness' in cloned)cloned.metalness=0;
    cloned.needsUpdate=true;
    if(Array.isArray(p.o.material)){
      const arr=p.o.material.slice();
      arr[p.index]=cloned;
      p.o.material=arr;
    }else p.o.material=cloned;
  }
}
