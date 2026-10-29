import numpy as np
import tensorflow as tf
import onnxruntime as ort

tflite_path = "public/models/mobilefacenet.tflite"
onnx_path = "public/models/mobilefacenet.onnx"

interpreter = tf.lite.Interpreter(model_path=tflite_path)
interpreter.allocate_tensors()

input_info = interpreter.get_input_details()[0]
output_info = interpreter.get_output_details()[0]

rng = np.random.default_rng(42)
x = rng.uniform(-1, 1, size=(1, 112, 112, 3)).astype(np.float32)

interpreter.set_tensor(input_info["index"], x)
interpreter.invoke()
tflite_output = interpreter.get_tensor(output_info["index"]).flatten()

session = ort.InferenceSession(
    onnx_path,
    providers=["CPUExecutionProvider"]
)
onnx_output = session.run(None, {"input": x})[0].flatten()

diff = np.abs(tflite_output - onnx_output)
cosine = np.dot(tflite_output, onnx_output) / (
    np.linalg.norm(tflite_output) * np.linalg.norm(onnx_output)
)

print("TFLite dimensions:", len(tflite_output))
print("ONNX dimensions:", len(onnx_output))
print("Maximum difference:", float(np.max(diff)))
print("Mean difference:", float(np.mean(diff)))
print("Cosine similarity:", float(cosine))
print("PARITY PASS:", bool(cosine >= 0.9999 and np.max(diff) < 0.001))
