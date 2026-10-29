'use client';

import {useEffect, useRef, useState} from 'react';
import {loadFaceModel} from '@/lib/mobile-attendance/browser-face-model';
import {buildStableFace, captureFaceObservation, type FaceObservation} from '@/lib/mobile-attendance/face-capture-quality';

type Status = {
  enrolled?: boolean;
  can_replace?: boolean;
  approval_expires_at?: string | null;
  model_name?: string | null;
  error?: string;
};
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

export default function EnrollClient() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking enrollment status...');

  function stopCamera() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setReady(false);
  }

  async function refresh() {
    try {
      const res = await fetch('/api/mobile-attendance/enrollment', {cache: 'no-store'});
      const data = await res.json() as Status;
      if (!res.ok) throw Error(data.error || 'Unable to check enrollment status');
      setStatus(data);
      setMessage(data.enrolled
        ? data.can_replace
          ? 'Face change approved. You can replace your enrolled face before approval expires.'
          : 'Face already enrolled. Request HR approval to replace it.'
        : 'No face enrolled. First-time enrollment is available.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    void refresh();
    return () => {stream.current?.getTracks().forEach(track => track.stop());};
  }, []);

  async function open() {
    try {
      if (!window.isSecureContext) throw Error('HTTPS required for camera');
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}},
      });
      stopCamera();
      stream.current = media;
      if (!video.current) throw Error('Camera preview is not ready');
      video.current.srcObject = media;
      await video.current.play();
      setReady(true);
      setMessage('Front camera ready. Keep one face centered, well-lit and still.');
    } catch (error) {
      stopCamera();
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function enroll() {
    if (!video.current || !ready || !status || (status.enrolled && !status.can_replace) || busy) return;
    setBusy(true);
    try {
      const element = video.current;
      setMessage('Preparing MobileFaceNet...');
      await loadFaceModel();
      const samples: FaceObservation[] = [];
      const deadline = Date.now() + 16000;
      while (samples.length < 5 && Date.now() < deadline) {
        try {
          const item = await captureFaceObservation(element,'face');
          samples.push(item);
          setMessage(`Checking face capture quality (${samples.length}/5)...`);
        } catch (error) {
          if (Date.now() >= deadline - 1000 && samples.length < 3) throw error;
        }
        if (samples.length < 5) await sleep(400);
      }
      if (samples.length < 3) throw Error('Could not capture enough face frames. Improve lighting and try again.');
      const stable = buildStableFace(samples);
      // Save the normalized consensus from matching frames, not a random capture.
      // The backend matching threshold and face-change approval are untouched.
      setMessage('Face quality confirmed. Saving enrollment...');
      const response = await fetch('/api/mobile-attendance/enrollment', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          embedding: stable.embedding,
          model_name: 'mobilefacenet',
          model_version: '1',
          photo_base64: stable.photo,
        }),
      });
      const body = await response.json() as {error?: string; success?: boolean; replaced?: boolean};
      if (!response.ok || body.success !== true) throw Error(body.error || 'Enrollment failed');
      stopCamera();
      await refresh();
      setMessage(body.replaced
        ? 'Approved face replacement successful. Your new enrolled face is ready for attendance.'
        : 'First-time face enrollment successful. Your face is ready for attendance.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="card" style={{maxWidth: 800, display: 'grid', gap: 16, padding: 24}}>
    <div style={{display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
      <h2 style={{margin: 0}}>My face</h2>
      <span style={{borderRadius: 999, padding: '8px 12px', background: status?.enrolled ? '#e1f5e9' : '#f0f0f2', color: '#18201c', fontWeight: 700}}>
        {status?.enrolled ? 'Registered' : status ? 'Enrollment required' : 'Checking...'}
      </span>
    </div>
    <p>For Employee, Department Head and HR. Existing enrollment can be replaced only during a valid approved face-change window.</p>
    {status?.can_replace && status.approval_expires_at && <p role="status" style={{padding: '12px 14px', borderRadius: 12, background: '#edf8f0', color: '#14632f', fontWeight: 700}}>
      Face replacement approved until {new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'}).format(new Date(status.approval_expires_at))} IST.
    </p>}
    <video ref={video} playsInline muted autoPlay style={{width: '100%', maxHeight: 380, objectFit: 'cover', background: '#171717', borderRadius: 16}}/>
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 12}}>
      <button type="button" onClick={() => void open()} disabled={busy}>Open front camera</button>
      <button type="button" onClick={() => void enroll()} disabled={busy || !ready || !status || (status.enrolled === true && !status.can_replace)}>
        {busy ? 'Checking face...' : status?.enrolled ? 'Replace approved face' : 'Enroll my face'}
      </button>
      <button type="button" onClick={() => void refresh()} disabled={busy}>Refresh status</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
    <p style={{fontSize: 13, color: '#626672'}}>The camera checks several face frames for consistency before saving. No blink/head-turn or third-party liveness service is used.</p>
    <a href="/mobile-attendance">← Attendance screen</a>
  </section>;
}
