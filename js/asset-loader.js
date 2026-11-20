import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

const loader=new GLTFLoader();
const dracoLoader=new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);

export function loadGLB(url){
  return new Promise((resolve,reject)=>loader.load(url,resolve,undefined,error=>{
    console.error('[ATELIER] Failed to load model:',url,error);
    reject(error);
  }));
}

export function loadOptionalGLB(url){
  return loadGLB(url).catch(error=>{
    console.warn('[ATELIER] Optional model unavailable:',url,error);
    return null;
  });
}
