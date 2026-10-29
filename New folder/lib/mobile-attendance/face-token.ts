// Final submission accepts only a server-issued biometric token and a fresh GPS reading.
// A browser camera/motion diagnostic is not a trusted liveness certificate.
export type VerifiedFaceProof = {
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  verification_token: string;
  gps: {latitude:number; longitude:number; accuracy:number; timestamp:number};
};
export async function submitVerifiedFaceProof(proof: VerifiedFaceProof) {
  const response = await fetch('/api/mobile-attendance/punch', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(proof), cache:'no-store', credentials:'same-origin'
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload==='object' && payload && 'error' in payload ? String(payload.error) : 'Face punch failed';
    throw new Error(message);
  }
  return payload;
}
