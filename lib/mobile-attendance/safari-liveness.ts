"use client";
/** Client-side guided motion diagnostic. NOT anti-spoof attestation; never authorize attendance from this result. */
type Landmark = {x:number;y:number;z?:number};
type Result = {faceLandmarks:Landmark[][]};
type Landmarker = {detectForVideo(video:HTMLVideoElement,timestamp:number):Result;close():void};
type VisionModule = {FilesetResolver:{forVisionTasks(url:string):Promise<unknown>};FaceLandmarker:{createFromOptions(wasm:unknown,options:unknown):Promise<Landmarker>}};
const ROOT='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const LANDMARKS='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
let singleton:Promise<Landmarker>|undefined;
export async function loadFaceLandmarker():Promise<Landmarker>{
  if(!singleton) singleton=(async()=>{
    const mod=await import(/* webpackIgnore: true */ `${ROOT}/+esm`) as VisionModule;
    const wasm=await mod.FilesetResolver.forVisionTasks(`${ROOT}/wasm`);
    return mod.FaceLandmarker.createFromOptions(wasm,{baseOptions:{modelAssetPath:LANDMARKS,delegate:'CPU'},runningMode:'VIDEO',numFaces:2,minFaceDetectionConfidence:.65,minFacePresenceConfidence:.65,minTrackingConfidence:.6});
  })();
  return singleton.catch(error=>{singleton=undefined;throw error;});
}
function dist(a:Landmark,b:Landmark){return Math.hypot(a.x-b.x,a.y-b.y)}
function eyeRatio(p:Landmark[],a:number,b:number,upper:number,lower:number){return dist(p[upper],p[lower])/Math.max(dist(p[a],p[b]),.00001)}
export type Motion={eyeOpenRatio:number;horizontalNoseOffset:number;faceCount:number};
export async function readFaceMotion(video:HTMLVideoElement):Promise<Motion>{
  if(!video.videoWidth||!video.videoHeight)throw Error('Camera frame unavailable');
  const model=await loadFaceLandmarker();const result=model.detectForVideo(video,performance.now());
  const count=result.faceLandmarks.length;
  if(count!==1)return {faceCount:count,eyeOpenRatio:0,horizontalNoseOffset:0};
  const p=result.faceLandmarks[0];
  if(p.length<478)throw Error('Landmark model returned incomplete face');
  // 33/133 and 362/263 are eye corners; 159/145 and 386/374 eyelid pairs.
  const eye=(eyeRatio(p,33,133,159,145)+eyeRatio(p,362,263,386,374))/2;
  const faceWidth=Math.max(dist(p[234],p[454]),.00001);
  const noseOffset=(p[1].x-(p[234].x+p[454].x)/2)/faceWidth;
  return {faceCount:1,eyeOpenRatio:eye,horizontalNoseOffset:noseOffset};
}
export type Stage='CENTER'|'BLINK'|'TURN_ONE'|'RETURN_CENTER'|'TURN_OTHER'|'FINISH_CENTER'|'DONE';
export type Challenge={stage:Stage;startedAt:number;stageAt:number;baselineEye:number;baselineNose:number;blinkClosed:boolean;frames:number;completedAt?:number};
export function beginChallenge(now=performance.now()):Challenge{return {stage:'CENTER',startedAt:now,stageAt:now,baselineEye:0,baselineNose:0,blinkClosed:false,frames:0}}
export function advanceChallenge(challenge:Challenge,m:Motion,now=performance.now()):Challenge{
  if(now-challenge.startedAt>30000)throw Error('Challenge timed out. Retry with your face centered.');
  if(m.faceCount!==1)throw Error(m.faceCount===0?'Face lost: position yourself in the frame.':'Multiple faces detected: only one person allowed.');
  if(challenge.stage==='DONE')return challenge;
  const c={...challenge};const centered=Math.abs(m.horizontalNoseOffset-c.baselineNose)<.085;
  if(c.stage==='CENTER'){
    c.baselineEye+=m.eyeOpenRatio;c.baselineNose+=m.horizontalNoseOffset;c.frames++;
    if(c.frames>=12){c.baselineEye/=c.frames;c.baselineNose/=c.frames;if(c.baselineEye<.12)throw Error('Keep your eyes open and face the camera.');c.stage='BLINK';c.stageAt=now;}
  }else if(c.stage==='BLINK'){
    if(m.eyeOpenRatio<c.baselineEye*.62)c.blinkClosed=true;
    if(c.blinkClosed&&m.eyeOpenRatio>c.baselineEye*.88){c.stage='TURN_ONE';c.stageAt=now;}
  }else if(c.stage==='TURN_ONE'){
    if(Math.abs(m.horizontalNoseOffset-c.baselineNose)>.12){c.stage='RETURN_CENTER';c.stageAt=now;}
  }else if(c.stage==='RETURN_CENTER'){
    if(centered){c.stage='TURN_OTHER';c.stageAt=now;}
  }else if(c.stage==='TURN_OTHER'){
    // Guided movement only; 2D offset cannot prove direction or live human presence.
    if(Math.abs(m.horizontalNoseOffset-c.baselineNose)>.12){c.stage='FINISH_CENTER';c.stageAt=now;}
  }else if(c.stage==='FINISH_CENTER'&&centered){c.stage='DONE';c.completedAt=now;}
  if(now-c.stageAt>12000)throw Error('Motion not detected in time. Restart the challenge.');
  return c;
}
export const challengeLabel:Record<Stage,string>={CENTER:'Look straight at the camera with eyes open',BLINK:'Blink once naturally',TURN_ONE:'Slowly turn your head to one side',RETURN_CENTER:'Look straight ahead again',TURN_OTHER:'Turn your head to the other side',FINISH_CENTER:'Look straight ahead to finish',DONE:'Motion diagnostic finished'};

