"use client";
/** Experimental browser model diagnostics. NEVER use its embedding as standalone attendance/liveness proof. */
export type FaceBox = {x:number;y:number;width:number;height:number};
type Shape = Array<number|string>;
type FaceModel = {inputs: Array<{shape: Shape}>; outputs:Array<{shape:Shape}>};
type ModelMeta = {
  dimensions: Shape;
  type: string;
};

function getModelMeta(
  metadata: unknown,
  names: readonly string[],
  name: string
): ModelMeta {
  const index = names.indexOf(name);

  if (index < 0) {
    throw new Error("ONNX tensor name not found: " + name);
  }

  const source = Array.isArray(metadata)
    ? metadata[index]
    : (metadata as Record<string, unknown> | null)?.[name];

  if (source == null) {
    throw new Error("ONNX metadata missing for: " + name);
  }

  const raw = source as {
    dimensions?: unknown;
    dims?: unknown; shape?: unknown;
    type?: unknown;
    dataType?: unknown;
  };

  const dimensions = Array.isArray(source)
    ? source
    : (raw.dimensions ?? raw.dims ?? raw.shape);

  if (!Array.isArray(dimensions)) {
    throw new Error(
      "ONNX dimensions unavailable for " + name +
      ". Metadata: " + JSON.stringify(source)
    );
  }

  return {
    dimensions: dimensions as Shape,
    type: String(raw.type ?? raw.dataType ?? "float32"),
  };
}
let sessionPromise:Promise<import('onnxruntime-web').InferenceSession>|undefined;
async function getSession(){
 if (!sessionPromise) sessionPromise=(async()=>{
  const ort=await import('onnxruntime-web');
  // Load WASM from the installed onnxruntime-web distribution (copied to /public/ort).
  ort.env.wasm.wasmPaths='/ort/';
  ort.env.wasm.numThreads=1; ort.env.wasm.proxy=false; ort.env.wasm.simd=false; // iOS Safari does not require cross-origin isolation for single-thread inference
  const response=await fetch('/models/mobilefacenet.onnx',{cache:'no-store'});
  if(!response.ok)throw new Error('Converted ONNX model not found at /models/mobilefacenet.onnx. Run conversion script first.');
  // iPhone Safari has a smaller usable WebAssembly heap. Avoid the costly
  // optimizer and extra WASM execution allocations. Face preprocessing and the
  // trained 192D model stay exactly the same.
  const modelBytes=await response.arrayBuffer();
  return ort.InferenceSession.create(modelBytes,{
    executionProviders:['wasm'],
    graphOptimizationLevel:'basic',
    executionMode:'sequential',
    enableCpuMemArena:false,
    enableMemPattern:false,
    intraOpNumThreads:1,
  });
 })();
 return sessionPromise.catch(e=>{
  sessionPromise=undefined;
  const message=e instanceof Error?e.message:String(e);
  if(/out of memory|no available backend|wasm.*memory/i.test(message)) {
    throw new Error('Face model ran out of browser memory. Close other Safari tabs, fully reopen Work Mate and retry. No attendance was saved.');
  }
  throw e;
});
}
export async function loadFaceModel():Promise<FaceModel>{const s=await getSession();return {inputs:s.inputNames.map(name=>({shape:getModelMeta(s.inputMetadata,s.inputNames,name).dimensions})),outputs:s.outputNames.map(name=>({shape:getModelMeta(s.outputMetadata,s.outputNames,name).dimensions}))};}
export function squareFaceBox(box:FaceBox,iw:number,ih:number):FaceBox{
 if(![box.x,box.y,box.width,box.height,iw,ih].every(Number.isFinite)||box.width<=0||box.height<=0||iw<=0||ih<=0)throw Error('Invalid face crop');
 const side=Math.min(Math.ceil(Math.max(box.width*1.55,box.height*1.45)),iw,ih);
 const cx=box.x+box.width/2,cy=box.y+box.height/2-box.height*.03;
 return {x:Math.max(0,Math.min(Math.round(cx-side/2),iw-side)),y:Math.max(0,Math.min(Math.round(cy-side/2),ih-side)),width:side,height:side};
}
export async function embedDetectedFace(image:CanvasImageSource,iw:number,ih:number,box:FaceBox):Promise<number[]>{
 const ort=await import('onnxruntime-web'),s=await getSession();
 const name=s.inputNames[0];const meta=getModelMeta(s.inputMetadata,s.inputNames,name);const dims=meta.dimensions;
 if(dims.length!==4)throw Error('Unsupported ONNX input dimensions');
 // Android's TFLite input is NHWC float32. Conversion tools sometimes transpose to NCHW.
 const nchw=dims[1]===3 && dims[3]!==3;
 const h=Number(nchw?dims[2]:dims[1]),w=Number(nchw?dims[3]:dims[2]);
 if(!Number.isInteger(h)||!Number.isInteger(w)||h<16||w<16||h>1024||w>1024)throw Error('Unknown ONNX image dimensions: '+JSON.stringify(dims));
 if(meta.type!=='float32')throw Error('Expected float32 ONNX input, received '+meta.type);
 const crop=squareFaceBox(box,iw,ih);const c=document.createElement('canvas');c.width=w;c.height=h;
 const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('2D canvas unavailable');
 ctx.imageSmoothingEnabled=true;ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,w,h);
 const rgba=ctx.getImageData(0,0,w,h).data;const values=new Float32Array(w*h*3);
 for(let p=0;p<w*h;p++){for(let ch=0;ch<3;ch++){const n=(rgba[p*4+ch]-127.5)/128;values[nchw?ch*w*h+p:p*3+ch]=n;}}
 const input=new ort.Tensor('float32',values,nchw?[1,3,h,w]:[1,h,w,3]);
 const feeds:Record<string,import('onnxruntime-web').Tensor>={[name]:input};
 const results=await s.run(feeds);const output=results[s.outputNames[0]];
 if(!output)throw Error('Model returned no embedding');
 const vector=Array.from(output.data as Float32Array|number[]).map(Number);
 if(vector.length<64||vector.length>4096||vector.some(n=>!Number.isFinite(n)))throw Error('Invalid embedding vector');
 const norm=Math.hypot(...vector);if(norm<1e-8)throw Error('Empty embedding');
 return vector.map(n=>n/norm);
}







