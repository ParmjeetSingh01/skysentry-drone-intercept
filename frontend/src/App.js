import { useRef, useEffect, useState, useCallback } from "react";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws/sim";
const COLORS = { THREAT:"#ff2222", WARN:"#ffaa00", SAFE:"#00ff41" };
const SC = { ONLINE:"#00ff41", CONNECTING:"#ffaa00", RECONNECTING:"#ffaa00", ERROR:"#ff2222" };
const STATUS_COL = { ENGAGE:"#ff2222",ARM:"#ffaa00",PURSUIT:"#ffff00",TRACK:"#00ccff",PATROL:"#00ff41",INTERCEPTED:"#ff00ff",SEARCH:"#aaaaff" };

function useSimWS() {
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("CONNECTING");
  const wsRef = useRef(null); const retryRef = useRef(null);
  const connect = useCallback(() => {
    setStatus("CONNECTING");
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setStatus("ONLINE");
    ws.onclose = () => { setStatus("RECONNECTING"); retryRef.current = setTimeout(connect, 2000); };
    ws.onerror = () => setStatus("ERROR");
    ws.onmessage = (e) => { try { setFrame(JSON.parse(e.data)); } catch {} };
    wsRef.current = ws;
  }, []);
  useEffect(() => { connect(); return () => { clearTimeout(retryRef.current); wsRef.current?.close(); }; }, [connect]);
  return { frame, status };
}

function Arena({ frame, width=800, height=600 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!frame) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle="#000810"; ctx.fillRect(0,0,width,height);
    ctx.strokeStyle="#001a00"; ctx.lineWidth=1;
    for(let x=0;x<width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
    for(let y=0;y<height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    const angle=(Date.now()/1250)%(2*Math.PI);
    ctx.strokeStyle="rgba(0,255,65,0.4)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(width/2,height/2);
    ctx.lineTo(width/2+Math.cos(angle)*900,height/2+Math.sin(angle)*900); ctx.stroke();
    ctx.strokeStyle="#003300"; ctx.lineWidth=2; ctx.setLineDash([6,4]);
    ctx.strokeRect(20,20,width-40,height-40); ctx.setLineDash([]);
    (frame.threats||[]).forEach(d=>{
      const col=COLORS[d.level]||"#fff", isTarget=d.id===frame.target_id;
      ctx.strokeStyle=col+"55"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-d.vx*10,d.y-d.vy*10); ctx.stroke();
      ctx.save(); ctx.translate(d.x,d.y); ctx.rotate(Math.atan2(d.vy,d.vx));
      ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(12,0);ctx.lineTo(0,-6);ctx.lineTo(-8,0);ctx.lineTo(0,6);ctx.closePath();ctx.fill();
      ctx.restore();
      if(isTarget){
        ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.arc(d.x,d.y,24,0,2*Math.PI); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle="#ffffff66"; ctx.lineWidth=1; ctx.beginPath();
        ctx.moveTo(d.x-34,d.y);ctx.lineTo(d.x+34,d.y);ctx.moveTo(d.x,d.y-34);ctx.lineTo(d.x,d.y+34);ctx.stroke();
      }
      ctx.fillStyle=col; ctx.font="11px 'Courier New'"; ctx.fillText(`[${d.level}] ${d.label}`,d.x+15,d.y-8);
      ctx.fillStyle="#888"; ctx.font="10px 'Courier New'"; ctx.fillText(`${d.conf} · ${d.alt}m AGL`,d.x+15,d.y+5);
    });
    const ic=frame.interceptor;
    if(ic){
      const rad=Math.atan2(Math.sin((ic.heading-90)*Math.PI/180),Math.cos((ic.heading-90)*Math.PI/180));
      ctx.save(); ctx.translate(ic.x,ic.y); ctx.rotate(rad);
      ctx.fillStyle="#00ccff"; ctx.shadowColor="#00ccff"; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.moveTo(0,-16);ctx.lineTo(8,8);ctx.lineTo(0,2);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();
      ctx.restore();
      const tgt=(frame.threats||[]).find(d=>d.id===frame.target_id);
      if(tgt){
        ctx.strokeStyle="#00ccff55"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.moveTo(ic.x,ic.y);ctx.lineTo(tgt.x,tgt.y);ctx.stroke();ctx.setLineDash([]);
        const ip=frame.intercept?.intercept_pos;
        if(ip){ctx.fillStyle="#ffffff33";ctx.beginPath();ctx.arc(ip[0],ip[1],7,0,2*Math.PI);ctx.fill();}
      }
      ctx.fillStyle="#00ccff"; ctx.font="bold 11px 'Courier New'";
      ctx.fillText(`▲ INTERCEPTOR [${ic.status}]`,ic.x+14,ic.y-12);
    }
    for(let y=0;y<height;y+=4){ctx.fillStyle="rgba(0,0,0,0.07)";ctx.fillRect(0,y,width,2);}
  },[frame,width,height]);
  return <canvas ref={canvasRef} width={width} height={height} style={{border:"1px solid #00ff41",boxShadow:"0 0 24px #00ff4144",display:"block"}}/>;
}

export default function App() {
  const { frame, status } = useSimWS();
  const ic=frame?.interceptor||{}, int=frame?.intercept||{}, st=frame?.stats||{};
  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#00ff41",fontFamily:"'Courier New',monospace",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 20px",borderBottom:"1px solid #003300",background:"#000d00"}}>
        <div style={{fontSize:15,fontWeight:"bold",letterSpacing:3}}>◉ SKYSENTRY — AI DRONE INTERCEPT</div>
        <div style={{display:"flex",gap:12,alignItems:"center",fontSize:12}}>
          <span style={{color:SC[status]||"#fff"}}>● {status}</span>
          <span style={{background:"#001a00",border:"1px solid #003300",color:"#556655",padding:"3px 8px",fontSize:10,letterSpacing:1}}>YOLO26 · NMS-FREE</span>
          {frame&&<span style={{color:"#334433",fontSize:10}}>FRAME #{frame.frame}</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:16,padding:16,flex:1,alignItems:"flex-start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:11,letterSpacing:2,color:"#556655"}}>▣ AERIAL SURVEILLANCE ARENA</div>
          <Arena frame={frame} width={800} height={600}/>
          <div style={{fontSize:10,color:"#556655"}}>
            <span style={{color:"#ff2222"}}>■ THREAT</span>&nbsp;&nbsp;
            <span style={{color:"#ffaa00"}}>■ WARN</span>&nbsp;&nbsp;
            <span style={{color:"#00ccff"}}>▲ INTERCEPTOR</span>
          </div>
        </div>
        <div style={{background:"#000d00",border:"1px solid #00ff4144",padding:14,minWidth:230,fontFamily:"'Courier New',monospace",fontSize:12}}>
          <div style={{color:"#00ff41",fontSize:11,letterSpacing:2,borderBottom:"1px solid #003300",paddingBottom:4,marginBottom:8}}>◈ INTERCEPTOR</div>
          <Row l="STATUS"   v={ic.status} c={STATUS_COL[ic.status]||"#fff"} big/>
          <Row l="POSITION" v={ic.x!=null?`${ic.x.toFixed(0)}, ${ic.y.toFixed(0)}`:"--"}/>
          <Row l="HEADING"  v={ic.heading!=null?`${ic.heading.toFixed(1)}°`:"--"}/>
          <div style={{borderTop:"1px solid #001a00",margin:"10px 0"}}/>
          <div style={{color:"#00ff41",fontSize:11,letterSpacing:2,borderBottom:"1px solid #003300",paddingBottom:4,marginBottom:8}}>◈ INTERCEPT</div>
          <Row l="DISTANCE" v={int.distance!=null?`${int.distance.toFixed(0)}px`:"--"}/>
          <Row l="ETA"      v={int.eta!=null?`${int.eta.toFixed(1)}s`:"--"}/>
          <Row l="STATUS"   v={int.status||"--"} c={STATUS_COL[int.status]||"#aaa"}/>
          <div style={{borderTop:"1px solid #001a00",margin:"10px 0"}}/>
          <div style={{color:"#00ff41",fontSize:11,letterSpacing:2,borderBottom:"1px solid #003300",paddingBottom:4,marginBottom:8}}>◈ THREATS</div>
          <Row l="TOTAL"   v={st.total_threats??0}/>
          <Row l="THREAT"  v={st.threat_count??0} c="#ff2222"/>
          <Row l="WARN"    v={st.warn_count??0}   c="#ffaa00"/>
          <Row l="ENGAGED" v={st.engaged?"YES":"NO"} c={st.engaged?"#ff2222":"#00ff41"}/>
          {(frame?.threats||[]).length>0&&<>
            <div style={{borderTop:"1px solid #001a00",margin:"10px 0"}}/>
            <div style={{color:"#00ff41",fontSize:11,letterSpacing:2,borderBottom:"1px solid #003300",paddingBottom:4,marginBottom:8}}>◈ ACTIVE</div>
            {frame.threats.map(d=>(
              <div key={d.id} style={{borderLeft:`3px solid ${d.level==="THREAT"?"#ff2222":"#ffaa00"}`,padding:"4px 8px",marginBottom:6,background:d.id===frame.target_id?"#0d1a0d":"#050a05"}}>
                <div style={{color:d.level==="THREAT"?"#ff2222":"#ffaa00",fontSize:11,fontWeight:"bold"}}>{d.level} · {d.label}</div>
                <div style={{color:"#556655",fontSize:10}}>({d.x?.toFixed(0)},{d.y?.toFixed(0)}) · {d.alt}m · {d.conf}</div>
                {d.id===frame.target_id&&<div style={{color:"#00ccff",fontSize:10}}>⬆ PRIMARY TARGET</div>}
              </div>
            ))}
          </>}
        </div>
      </div>
      <div style={{borderTop:"1px solid #003300",padding:"8px 20px",fontSize:10,color:"#334433",textAlign:"center"}}>
        SkySentry v1.0 · YOLO26 NMS-free + Proportional Navigation · Patent-backed AI/IoT System
      </div>
    </div>
  );
}
function Row({l,v,c="#00ff41",big=false}){
  return <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#556655"}}>{l}</span><span style={{color:c,fontWeight:big?"bold":"normal",fontSize:big?14:12}}>{v}</span></div>;
}
