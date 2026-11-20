import * as THREE from 'three';

export function makeStarGlowTexture(){
  const c=document.createElement('canvas');
  c.width=c.height=256;
  const ctx=c.getContext('2d');
  const cx=128,cy=128;
  const halo=ctx.createRadialGradient(cx,cy,2,cx,cy,124);
  halo.addColorStop(0,'rgba(255,255,235,1)');
  halo.addColorStop(.10,'rgba(255,247,195,.98)');
  halo.addColorStop(.28,'rgba(255,228,140,.72)');
  halo.addColorStop(.55,'rgba(255,210,110,.32)');
  halo.addColorStop(.82,'rgba(255,195,90,.10)');
  halo.addColorStop(1,'rgba(255,185,80,0)');
  ctx.fillStyle=halo;
  ctx.fillRect(0,0,256,256);

  ctx.save();
  ctx.translate(cx,cy);
  ctx.globalCompositeOperation='lighter';
  const drawRay=(angle,w,h,alpha)=>{
    ctx.save();
    ctx.rotate(angle);
    const g=ctx.createLinearGradient(0,-h/2,0,h/2);
    g.addColorStop(0,'rgba(255,246,210,0)');
    g.addColorStop(.42,'rgba(255,246,210,'+(alpha*.35)+')');
    g.addColorStop(.5,'rgba(255,255,238,'+alpha+')');
    g.addColorStop(.58,'rgba(255,246,210,'+(alpha*.35)+')');
    g.addColorStop(1,'rgba(255,246,210,0)');
    ctx.fillStyle=g;
    ctx.fillRect(-w/2,-h/2,w,h);
    ctx.restore();
  };
  drawRay(0,12,174,.96);
  drawRay(Math.PI/2,12,174,.96);
  drawRay(Math.PI/4,7,112,.58);
  drawRay(-Math.PI/4,7,112,.58);

  ctx.beginPath();
  const outer=32,inner=7;
  for(let i=0;i<8;i++){
    const a=-Math.PI/2+i*Math.PI/4;
    const r=i%2===0?outer:inner;
    const x=Math.cos(a)*r;
    const y=Math.sin(a)*r;
    if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle='rgba(255,255,238,1)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0,0,8,0,Math.PI*2);
  ctx.fillStyle='#fffdf0';
  ctx.fill();
  ctx.restore();

  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

export function makeWarmGlowTexture(){
  const c=document.createElement('canvas');
  c.width=c.height=256;
  const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(128,128,8,128,128,120);
  g.addColorStop(0,'rgba(255,246,205,.98)');
  g.addColorStop(.20,'rgba(255,222,135,.78)');
  g.addColorStop(.50,'rgba(255,188,80,.34)');
  g.addColorStop(1,'rgba(255,160,55,0)');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,256,256);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

export function makeWaterNormalTexture(){
  const size=256;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  const img=ctx.createImageData(size,size);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const nx=x/size*Math.PI*2;
      const ny=y/size*Math.PI*2;
      const wave=
        Math.sin(nx*5.0+Math.sin(ny*2.0))*0.55+
        Math.sin(ny*8.0+nx*1.7)*0.28+
        Math.sin((nx+ny)*12.0)*0.17;
      const gx=Math.cos(nx*5.0+Math.sin(ny*2.0))*0.55+
               Math.cos((nx+ny)*12.0)*0.20;
      const gy=Math.cos(ny*8.0+nx*1.7)*0.40+
               Math.cos((nx+ny)*12.0)*0.18;
      const i=(y*size+x)*4;
      img.data[i]=THREE.MathUtils.clamp(128+gx*48,0,255);
      img.data[i+1]=THREE.MathUtils.clamp(128+gy*48,0,255);
      img.data[i+2]=THREE.MathUtils.clamp(238+wave*10,0,255);
      img.data[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(canvas);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(7,7);
  tex.colorSpace=THREE.NoColorSpace;
  tex.needsUpdate=true;
  return tex;
}
