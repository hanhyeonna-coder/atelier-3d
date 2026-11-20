import * as THREE from 'three';

export function createWorkPromptController(scene){
  let sprite=null;
  let promptKey=null;

  function ensure(){
    if(sprite)return sprite;
    const canvas=document.createElement('canvas');
    canvas.width=16;
    canvas.height=180;
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.SpriteMaterial({
      map:texture,
      transparent:true,
      depthTest:false,
      depthWrite:false
    });
    sprite=new THREE.Sprite(material);
    sprite.name='Work Prompt';
    sprite.renderOrder=50;
    sprite.visible=false;
    scene.add(sprite);
    return sprite;
  }

  function draw(text){
    ensure();
    const font='700 54px -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif';
    const measure=document.createElement('canvas').getContext('2d');
    measure.font=font;
    const textWidth=Math.ceil(measure.measureText(text).width);
    const padX=48;
    const w=Math.max(220,textWidth+padX*2);
    const h=180;
    const canvas=document.createElement('canvas');
    canvas.width=w;
    canvas.height=h;
    const ctx=canvas.getContext('2d');

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='rgba(255,255,255,.90)';
    ctx.strokeStyle='rgba(93,70,54,.28)';
    ctx.lineWidth=5;
    ctx.beginPath();
    ctx.roundRect(12,12,w-24,h-24,52);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle='#4c3a30';
    ctx.font=font;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(text,w/2,h/2+1);

    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.needsUpdate=true;
    const oldTexture=sprite.material.map;
    sprite.material.map=texture;
    sprite.material.needsUpdate=true;
    oldTexture?.dispose?.();

    const worldHeight=.56;
    sprite.scale.set(worldHeight*(w/h),worldHeight,1);
  }

  function hide(){
    if(sprite)sprite.visible=false;
    promptKey=null;
  }

  function update({
    playerSeat,
    playerArtworkSeat,
    blockedPromptSeat,
    blockedPromptUntil,
    isArtworkLocked,
    blockedEaselPrompts,
    workPrompts
  }){
    ensure();
    const now=performance.now();
    const blockedActive=
      blockedPromptSeat &&
      blockedPromptUntil>now &&
      isArtworkLocked(blockedPromptSeat);

    const targetSeat=blockedActive?blockedPromptSeat:playerSeat;
    if(!targetSeat){
      hide();
      return;
    }

    const prompts=blockedActive
      ? blockedEaselPrompts(targetSeat)
      : ((playerArtworkSeat===playerSeat)?['작업 중...','그림 바꾸기']:workPrompts);

    const idx=Math.floor(now/3500)%prompts.length;
    const nextKey=(blockedActive?'blocked|':'work|')+idx+'|'+prompts[idx];
    if(nextKey!==promptKey){
      promptKey=nextKey;
      draw(prompts[idx]);
    }

    const box=new THREE.Box3().setFromObject(targetSeat.easel);
    const center=box.getCenter(new THREE.Vector3());
    sprite.position.set(center.x,box.max.y+.62,center.z);
    sprite.visible=true;
  }

  function hitTest(raycaster){
    return !!(sprite?.visible && raycaster.intersectObject(sprite,false).length);
  }

  return {update,hide,hitTest};
}
