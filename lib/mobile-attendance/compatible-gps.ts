export type VerifiedGPS={latitude:number;longitude:number;accuracy:number;timestamp:number};

// Only accept a real, accurate, recently obtained browser fix. The server still
// independently checks freshness, accuracy and the selected office geofence.
const MAX_ACCURACY_METERS=100;
const MAX_FIX_AGE_MS=15000;

function getPosition(options:PositionOptions):Promise<GeolocationPosition>{
 return new Promise((resolve,reject)=>{
  if(typeof navigator==='undefined'||!navigator.geolocation){reject(new Error('GPS unavailable on this browser.'));return;}
  navigator.geolocation.getCurrentPosition(resolve,reject,options);
 });
}
function validate(p:GeolocationPosition):VerifiedGPS{
 const {latitude,longitude,accuracy}=p.coords;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||latitude< -90||latitude>90||longitude< -180||longitude>180||accuracy<0)throw Error('GPS returned invalid coordinates. Retry Location.');
 if(!Number.isFinite(p.timestamp)||p.timestamp>Date.now()+5000||Date.now()-p.timestamp>MAX_FIX_AGE_MS)throw Error('GPS location is stale. Retry Location for a fresh fix.');
 if(accuracy>MAX_ACCURACY_METERS)throw Error(`GPS accuracy ±${Math.round(accuracy)}m is insufficient (requires 100m or better). Move near a window and retry.`);
 return {latitude,longitude,accuracy,timestamp:p.timestamp};
}
function explain(err:unknown):Error{
 const e=err as GeolocationPositionError;
 if(e?.code===1)return Error('GPS permission denied. Allow Location access in browser settings and retry.');
 if(e?.code===2)return Error('GPS position unavailable. Enable Location and move near a window, then retry.');
 if(e?.code===3)return Error('GPS timed out on this device. Retry GPS Location, preferably near a window.');
 return err instanceof Error?err:Error('GPS could not be acquired. Retry Location.');
}
export async function acquireVerifiedGps():Promise<VerifiedGPS>{
 if(typeof window==='undefined'||!window.isSecureContext)throw Error('GPS requires HTTPS or localhost.');
 try{
  return validate(await getPosition({enableHighAccuracy:true,maximumAge:0,timeout:40000}));
 }catch(first){
  const code=(first as GeolocationPositionError)?.code;
  // Permission denial, stale coordinates and poor accuracy must not be bypassed.
  // A second provider attempt only helps hardware-level timeout/unavailable cases.
  if(code!==2&&code!==3)throw explain(first);
  try{
   return validate(await getPosition({enableHighAccuracy:false,maximumAge:0,timeout:15000}));
  }catch(second){throw explain(second);}
 }
}
