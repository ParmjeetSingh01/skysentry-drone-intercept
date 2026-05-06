const M='"Share Tech Mono",monospace';
function Row({label,value,alert}){
  return <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid rgba(59,130,246,0.06)'}}>
    <span style={{color:'rgba(59,130,246,0.45)',fontSize:11,letterSpacing:1}}>{label}</span>
    <span style={{color:alert?'#ff3b30':'#60a5fa',fontFamily:M,fontSize:12,fontWeight:'bold'}}>{value??'—'}</span>
  </div>;
}
export default function Panel({data,connected}){
  const t=data?.target,ic=t?.intercept,stats=data?.stats||{};
  const isAlert=data?.status?.includes('THREAT');
  return <div style={{display:'flex',flexDirection:'column',gap:14,fontFamily:M}}>
    <div style={{padding:'10px 14px',border:'1px solid '+(isAlert?'#ff3b30':'#60a5fa'),borderRadius:4,background:isAlert?'rgba(255,59,48,0.08)':'rgba(59,130,246,0.04)'}}>
      <div style={{fontSize:10,color:'rgba(59,130,246,0.5)',letterSpacing:2,marginBottom:4}}>SYSTEM STATUS</div>
      <div style={{fontSize:14,fontWeight:'bold',letterSpacing:2,color:isAlert?'#ff3b30':'#60a5fa'}}>{connected?data?.status:'● CONNECTING...'}</div>
    </div>
    <div>
      <div style={{fontSize:10,color:'rgba(0,255,100,0.4)',letterSpacing:2,marginBottom:8}}>LIVE TELEMETRY</div>
      <Row label="Frame" value={data?.frame?.toString().padStart(6,'0')}/>
      <Row label="Active Threats" value={data?.tracks?.length??0} alert={data?.tracks?.length>0}/>
      <Row label="Intercepted" value={stats.intercepted??0}/>
      <Row label="Total Tracked" value={stats.total_threats??0}/>
    </div>
    {t&&<div style={{borderTop:'1px solid rgba(0,255,100,0.1)',paddingTop:14}}>
      <div style={{fontSize:10,color:'rgba(255,59,48,0.8)',letterSpacing:2,marginBottom:8}}>PRIMARY — TGT-{t.id}</div>
      <Row label="X" value={t.position?.[0]?.toFixed(1)}/>
      <Row label="Y" value={t.position?.[1]?.toFixed(1)}/>
      <Row label="Vx" value={t.velocity?.[0]?.toFixed(2)}/>
      <Row label="Vy" value={t.velocity?.[1]?.toFixed(2)}/>
      <Row label="Score" value={((t.score||0)*100).toFixed(0)+'%'} alert={(t.score||0)>.65}/>
    </div>}
    {ic&&<div style={{borderTop:'1px solid rgba(0,255,100,0.1)',paddingTop:14}}>
      <div style={{fontSize:10,color:'rgba(0,212,255,0.8)',letterSpacing:2,marginBottom:8}}>INTERCEPT SOLUTION</div>
      <Row label="Heading" value={ic.heading_deg?.toFixed(1)+'°'}/>
      <Row label="TTI" value={ic.tti?.toFixed(2)+' frames'}/>
      <Row label="Distance" value={ic.distance?.toFixed(0)+' px'}/>
      <Row label="Feasible" value={ic.feasible?'✓ YES':'✗ NO'} alert={!ic.feasible}/>
    </div>}
    {data?.interceptor&&<div style={{borderTop:'1px solid rgba(0,255,100,0.1)',paddingTop:14}}>
      <div style={{fontSize:10,color:'rgba(0,212,255,0.5)',letterSpacing:2,marginBottom:8}}>INTERCEPTOR</div>
      <Row label="X" value={data.interceptor.x?.toFixed(1)}/>
      <Row label="Y" value={data.interceptor.y?.toFixed(1)}/>
      <Row label="Speed" value={data.interceptor.speed+' px/f'}/>
    </div>}
  </div>;
}
