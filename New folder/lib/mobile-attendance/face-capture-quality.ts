'use client';

/**
 * Shared, deterministic browser capture path for first enrollment and attendance.
 * MediaPipe detects a bounding box on the live video, then we freeze the next
 * frame immediately. Both MobileFaceNet and the evidence JPEG use that frozen
 * snapshot instead of reading the moving <video> again after async inference.
 *
 * Capture consistency is NOT anti-spoof / liveness verification.
 */
import {detectOneFace} from './safari-face-detector';
import {embedDetectedFace, squareFaceBox, type FaceBox} from './browser-face-model';

export type FaceObservation={embedding:number[];photo:string;quality:number};
export type StableFace={embedding:number[];medoid:number[];photo:string;agreement:number};

const VECTOR_LENGTH=192;
const CAPTURE_MATCH_MIN=0.72; // quality/consistency only. Server face threshold unchanged.

export function faceCosine(a:readonly number[],b:readonly number[]):number {
 if(a.length!==VECTOR_LENGTH||b.length!==VECTOR_LENGTH)return -1;
 let dot=0,aa=0,bb=0;
 for(let i=0;i<VECTOR_LENGTH;i++){
  if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))return -1;
  dot+=a[i]*b[i]; aa+=a[i]*a[i];bb+=b[i]*b[i];
 }
 return aa>1e-12&&bb>1e-12?dot/Math.sqrt(aa*bb):-1;
}

/** Collect exactly one face; no mirroring, sharpening filter or model change. */
export async function captureFaceObservation(video:HTMLVideoElement,photoKind:'frame'|'face'):Promise<FaceObservation>{
 if(!video.videoWidth||!video.videoHeight||video.readyState<2)throw Error('Wait for the camera image to become ready.');
 const bounds=await detectOneFace(video);
 // Very small faces make MobileFaceNet's 112px crop unreliable.
 if(bounds.width/video.videoWidth<0.14||bounds.height/video.videoHeight<0.14){
  throw Error('Move a little closer and keep your face centered.');
 }
 // Scale once so all devices infer a frozen, bounded-resolution image.
 const scale=Math.min(1,720/video.videoWidth,720/video.videoHeight);
 const canvas=document.createElement('canvas');
 canvas.width=Math.round(video.videoWidth*scale);
 canvas.height=Math.round(video.videoHeight*scale);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Camera canvas unavailable');
 ctx.imageSmoothingEnabled=true;
 ctx.imageSmoothingQuality='high';
 ctx.drawImage(video,0,0,canvas.width,canvas.height);
 const box:FaceBox={x:bounds.x*scale,y:bounds.y*scale,width:bounds.width*scale,height:bounds.height*scale};
 const region=squareFaceBox(box,canvas.width,canvas.height);
 try{
  const check=document.createElement('canvas');
  check.width=48;check.height=48;
  const cctx=check.getContext('2d',{willReadFrequently:true});
  if(!cctx)throw Error('Face quality check unavailable');
  cctx.drawImage(canvas,region.x,region.y,region.width,region.height,0,0,48,48);
  const rgba=cctx.getImageData(0,0,48,48).data;
  let mean=0,second=0,gradient=0;
  const gray=new Float32Array(48*48);
  for(let i=0;i<gray.length;i++){
   const p=i*4;
   const v=rgba[p]*.2126+rgba[p+1]*.7152+rgba[p+2]*.0722;
   gray[i]=v;mean+=v;second+=v*v;
  }
  mean/=gray.length;
  const deviation=Math.sqrt(Math.max(0,second/gray.length-mean*mean));
  for(let y=1;y<47;y++)for(let x=1;x<47;x++){
   const p=y*48+x;
   gradient+=Math.abs(4*gray[p]-gray[p-48]-gray[p+48]-gray[p-1]-gray[p+1]);
  }
  gradient/=46*46;
  check.width=0;check.height=0;
  // Only reject clearly unusable lighting/blur, not specific skin tones.
  if(mean<24||mean>235||deviation<10||gradient<2.2)throw Error('Face image is too dark, overexposed or blurry. Improve lighting and keep still.');
  const quality=Math.min(1,gradient/24)*.5+Math.min(1,deviation/48)*.5;
  const embedding=await embedDetectedFace(canvas,canvas.width,canvas.height,box);
  if(embedding.length!==VECTOR_LENGTH)throw Error('Face model output dimension mismatch');
  let encoded:string;
  if(photoKind==='frame'){
   encoded=canvas.toDataURL('image/jpeg',.8).split(',')[1];
  }else{
   const face=document.createElement('canvas');face.width=512;face.height=512;
   const fctx=face.getContext('2d');
   if(!fctx)throw Error('Face image capture unavailable');
   fctx.drawImage(canvas,region.x,region.y,region.width,region.height,0,0,512,512);
   encoded=face.toDataURL('image/jpeg',.82).split(',')[1];
   face.width=0;face.height=0;
  }
  if(!encoded||encoded.length>2_000_000)throw Error('Face photo could not be captured. Please retry.');
  return {embedding,photo:encoded,quality};
 }finally{
  // Release the full camera snapshot before opening another inference frame.
  canvas.width=0;canvas.height=0;
 }
}

/** Stable three-plus-frame consensus; returns a single normalized 192D vector. */
export function buildStableFace(observations:readonly FaceObservation[]):StableFace{
 if(observations.length<3)throw Error('Face scan incomplete. Keep the phone still and retry.');
 let best=-1,bestAgreement=-Infinity,bestQuality=-Infinity;
 for(let i=0;i<observations.length;i++){
  const scores=observations.map((obs,j)=>j===i?-1:faceCosine(observations[i].embedding,obs.embedding))
   .filter(n=>n>=-0.5).sort((a,b)=>b-a);
  if(scores.length<2)continue;
  const agreement=scores[1];
  const quality=observations[i].quality;
  if(agreement>bestAgreement+0.0001||(Math.abs(agreement-bestAgreement)<=0.0001&&quality>bestQuality)){
   best=i;bestAgreement=agreement;bestQuality=quality;
  }
 }
 if(best<0||bestAgreement<CAPTURE_MATCH_MIN){
  throw Error('Face scan is inconsistent. Face the camera, hold still and try again in even light.');
 }
 const anchor=observations[best];
 // Only combine high-agreement samples. Outliers never enter the template.
 const cluster=observations.filter(obs=>faceCosine(anchor.embedding,obs.embedding)>=CAPTURE_MATCH_MIN);
 if(cluster.length<3)throw Error('Not enough consistent face frames. Please retry.');
 const summed=new Array<number>(VECTOR_LENGTH).fill(0);
 for(const obs of cluster)for(let i=0;i<VECTOR_LENGTH;i++)summed[i]+=obs.embedding[i];
 const norm=Math.hypot(...summed);
 if(!Number.isFinite(norm)||norm<1e-8)throw Error('Face scan could not be normalized.');
 return {embedding:summed.map(n=>n/norm),medoid:anchor.embedding,photo:anchor.photo,agreement:bestAgreement};
}
