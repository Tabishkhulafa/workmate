export type Gps={latitude:number;longitude:number;accuracy:number;timestamp:number};
export type Office={id:string;name:string;latitude:number;longitude:number;allowed_radius_meters:number};
export function metres(a:Gps,b:Office){const rad=Math.PI/180,R=6371000;const lat=(b.latitude-a.latitude)*rad,lon=(b.longitude-a.longitude)*rad;const n=Math.sin(lat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(lon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(n)));}
export function checkGps(g:Gps,office:Office,at=Date.now()){
 if(![g.latitude,g.longitude,g.accuracy,g.timestamp,office.latitude,office.longitude].every(Number.isFinite))return {ok:false,error:'Invalid location'};
 if(Math.abs(g.latitude)>90||Math.abs(g.longitude)>180||g.accuracy<=0)return {ok:false,error:'Invalid GPS reading'};
 if(Math.abs(at-g.timestamp)>120000)return {ok:false,error:'GPS reading expired'};
 if(g.accuracy>100)return {ok:false,error:'GPS accuracy too low'};
 const distance=metres(g,office);
 // Account for GPS uncertainty: do not treat a rough location at the boundary as proof of presence.
 if(distance+g.accuracy>office.allowed_radius_meters)return {ok:false,error:'Not reliably inside the approved office radius',distance};
 return {ok:true,distance};
}
