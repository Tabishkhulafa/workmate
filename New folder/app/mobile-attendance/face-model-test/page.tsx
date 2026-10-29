'use client';
import { useEffect, useRef, useState } from 'react';
import { loadFaceModel, embedDetectedFace } from '@/lib/mobile-attendance/browser-face-model';
import { detectOneFace } from '@/lib/mobile-attendance/safari-face-detector';

/** Face-model diagnostic only; it never issues verification tokens or saves attendance. */
export default function FaceModelTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shape, setShape] = useState('');
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('Open the camera to test MobileFaceNet.');
  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); }, []);
  async function openCamera() {
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS or localhost.');
      streamRef.current?.getTracks().forEach(track => track.stop());
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
      streamRef.current = media;
      if (videoRef.current) { videoRef.current.srcObject = media; await videoRef.current.play(); }
      setReady(true); setVerified(false); setMessage('Front camera ready.');
    } catch (error) { setReady(false); setMessage(error instanceof Error ? error.message : 'Camera unavailable'); }
  }
  async function testEmbedding() {
    const video = videoRef.current;
    if (!video || !ready) return;
    setBusy(true); setVerified(false);
    try {
      const model = await loadFaceModel();
      setShape(`${JSON.stringify(model.inputs[0]?.shape)} → ${JSON.stringify(model.outputs[0]?.shape)}`);
      const face = await detectOneFace(video);
      const embedding = await embedDetectedFace(video, video.videoWidth, video.videoHeight, face);
      if (embedding.length !== 192) throw new Error(`Expected 192-dimensional embedding, got ${embedding.length}.`);
      setVerified(true);
      setMessage('One face detected. 192-dimensional embedding generated locally. Nothing uploaded or recorded.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Embedding test failed.'); }
    finally { setBusy(false); }
  }
  return <main className="card" style={{ maxWidth: 820, margin: '2rem auto', padding: 24, display: 'grid', gap: 16 }}>
    <h1>Work Mate · Face Model Test</h1>
    <p>Front camera → one-face detection → MobileFaceNet embedding. No blink or head-turn challenge.</p>
    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 420, background: '#161616', borderRadius: 16, objectFit: 'cover' }} />
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <button type="button" onClick={() => void openCamera()} disabled={busy}>Open front camera</button>
      <button type="button" onClick={() => void testEmbedding()} disabled={!ready || busy}>{busy ? 'Testing…' : 'Test face embedding'}</button>
    </div>
    {shape && <p>MobileFaceNet: <strong>{shape}</strong></p>}
    <p>Embedding test: <strong>{verified ? 'Passed locally' : 'Not confirmed'}</strong></p>
    <p role="status">{message}</p>
    <div className="notice"><strong>Face attendance not submitted.</strong> Local face recognition is not equivalent to authenticated identity verification or anti-spoof protection. Server-validated verification is required before Face Clock In/Out can be enabled.</div>
    <a href="/mobile-attendance/enroll">Face enrollment/status</a>
    <a href="/mobile-attendance">GPS attendance</a>
  </main>;
}
