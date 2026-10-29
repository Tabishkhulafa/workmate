'use client';
import type {FaceBox} from './browser-face-model';

// Image mode: no motion between bounding-box detection and recognition crop.
// This changes detection sensitivity, NOT the server's biometric match threshold.
type Detection={boundingBox?:{originX:number;originY:number;width:number;height:number}};
type FaceInput=HTMLVideoElement|HTMLCanvasElement;
type Detector={detect(image:FaceInput):{detections:Detection[]};close():void};
let detectorPromise:Promise<Detector>|undefined;
export async function loadSafariDetector():Promise<Detector>{
 if(!detectorPromise)detectorPromise=(async()=>{
  const url='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm';
  const mod=await import(/* webpackIgnore: true */ url) as {
   FilesetResolver:{forVisionTasks(url:string):Promise<unknown>};
   FaceDetector:{createFromOptions(wasm:unknown,options:unknown):Promise<Detector>};
  };
  const wasm=await mod.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
  return mod.FaceDetector.createFromOptions(wasm,{
   baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',delegate:'CPU'},
   runningMode:'IMAGE',minDetectionConfidence:0.55,
  });
 })();
 return detectorPromise.catch(err=>{detectorPromise=undefined;throw err;});
}
export async function detectOneFace(image:FaceInput):Promise<FaceBox>{
 const width=image instanceof HTMLVideoElement?image.videoWidth:image.width;
 const height=image instanceof HTMLVideoElement?image.videoHeight:image.height;
 if(width<=0||height<=0)throw Error('Camera has no usable image. Wait a moment and retry.');
 const detector=await loadSafariDetector();
 const detections=detector.detect(image).detections;
 if(detections.length===0)throw Error('Face not detected. Move closer, face the camera and improve lighting.');
 if(detections.length!==1)throw Error('Multiple faces detected. Only one person can be in the camera frame.');
 const b=detections[0].boundingBox;
 if(!b||b.width<Math.max(48,width*.12)||b.height<Math.max(48,height*.12))throw Error('Face is too small. Move closer to the camera.');
 return {x:b.originX,y:b.originY,width:b.width,height:b.height};
}
