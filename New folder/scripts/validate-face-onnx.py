from pathlib import Path
import numpy as np
import onnx
import onnxruntime as ort
p=Path('public/models/mobilefacenet.onnx')
if not p.exists(): raise SystemExit('ONNX model missing')
model=onnx.load(str(p));onnx.checker.check_model(model)
s=ort.InferenceSession(str(p),providers=['CPUExecutionProvider'])
x=s.get_inputs()[0]
print('Input:',x.name,x.shape,x.type)
shape=[]
for dim in x.shape:
    if isinstance(dim,int) and dim>0: shape.append(dim)
    elif len(shape)==0: shape.append(1)
    else: raise SystemExit('Dynamic spatial input shape: manual inspection required')
if len(shape)!=4 or not(3 in [shape[1],shape[3]]): raise SystemExit('Unexpected face model input tensor')
y=s.run(None,{x.name:np.zeros(shape,dtype=np.float32)})[0]
if y.size<64 or y.size>4096 or not np.isfinite(y).all(): raise SystemExit('Invalid output')
print('Output:',y.shape,'sanity passed (not embedding parity)')
