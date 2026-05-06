import { useRef, useEffect, useState, useCallback } from "react";

const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws/sim";

function useSimWS() {
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const connect = useCallback(() => {
    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setStatus("online");
    ws.onclose = () => { setStatus("reconnecting"); retryRef.current = setTimeout(connect, 2000); };
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => { try { setFrame(JSON.parse(e.data)); } catch {} };
    wsRef.current = ws;
  }, []);
  useEffect(() => { connect(); return () => { clearTimeout(retryRef.current); wsRef.current?.close(); }; }, [connect]);
  return { frame, status };
}

const THREAT_COLOR = { THREAT: "#ef4444", WARN: "#f59e0b", SAFE: "#22c55e" };
const STATUS_DOT = { online: "#22c55e", connecting: "#f59e0b", reconnecting: "#f59e0b", error: "#ef4444" };

function RadarCanvas({ frame, width = 740, height = 500 }) {
  const canvasRef = useRef(null);
  const tickRef = useRef(0);
  useEffect(() => {
    if (!frame) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    tickRef.current += 1;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(148,163,184,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const cx = width / 2, cy = height / 2;
    [80, 160, 240, 320].forEach(r => {
      ctx.strokeStyle = "rgba(148,163,184,0.08)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
    });
    const angle = (tickRef.current * 0.03) % (2 * Math.PI);
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(34,197,94,0.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * 370, Math.sin(angle) * 370); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 370, angle - 0.6, angle);
    ctx.fillStyle = "rgba(34,197,94,0.04)"; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(148,163,184,0.12)"; ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]); ctx.strokeRect(24, 24, width - 48, height - 48); ctx.setLineDash([]);
    (frame.threats || []).forEach(d => {
      const col = THREAT_COLOR[d.level] || "#94a3b8";
      const isTarget = d.id === frame.target_id;
      ctx.strokeStyle = col + "30"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.vx * 12, d.y - d.vy * 12); ctx.stroke();
      ctx.save(); ctx.translate(d.x, d.y);
      ctx.fillStyle = col + "22"; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      const hdg = Math.atan2(d.vy, d.vx);
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hdg) * 14, Math.sin(hdg) * 14); ctx.stroke();
      ctx.restore();
      if (isTarget) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(d.x, d.y, 18, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = col; ctx.font = "500 11px -apple-system,sans-serif";
      ctx.fillText(d.label, d.x + 14, d.y - 4);
      ctx.fillStyle = "rgba(148,163,184,0.8)"; ctx.font = "10px -apple-system,sans-serif";
      ctx.fillText(`${d.alt}m  ·  ${d.conf}`, d.x + 14, d.y + 8);
    });
    const ic = frame.interceptor;
    if (ic) {
      const rad = Math.atan2(Math.sin((ic.heading - 90) * Math.PI / 180), Math.cos((ic.heading - 90) * Math.PI / 180));
      ctx.save(); ctx.translate(ic.x, ic.y); ctx.rotate(rad);
      ctx.fillStyle = "#3b82f6"; ctx.strokeStyle = "#93c5fd"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7);
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      const tgt = (frame.threats || []).find(d => d.id === frame.target_id);
      if (tgt) {
        ctx.strokeStyle = "rgba(59,130,246,0.3)"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(ic.x, ic.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke(); ctx.setLineDash([]);
        const ip = frame.intercept?.intercept_pos;
        if (ip) { ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ip[0], ip[1], 5, 0, 2 * Math.PI); ctx.stroke(); }
      }
      ctx.fillStyle = "#93c5fd"; ctx.font = "500 11px -apple-system,sans-serif";
      ctx.fillText("Interceptor", ic.x + 14, ic.y - 4);
      ctx.fillStyle = "rgba(148,163,184,0.7)"; ctx.font = "10px -apple-system,sans-serif";
      ctx.fillText(ic.status, ic.x + 14, ic.y + 8);
    }
  }, [frame, width, height]);
  return <canvas ref={canvasRef} width={width} height={height} style={{ display: "block", borderRadius: 8, width: "100%", height: "auto" }} />;
}

function Badge({ label, color }) {
  const bg = { red:"#450a0a",amber:"#451a03",blue:"#172554",green:"#052e16",gray:"#1e293b" };
  const text = { red:"#fca5a5",amber:"#fcd34d",blue:"#93c5fd",green:"#86efac",gray:"#94a3b8" };
  return <span style={{ background:bg[color]||bg.gray, color:text[color]||text.gray, fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:4 }}>{label}</span>;
}

function Stat({ label, value, color }) {
  const colors = { red:"#ef4444",amber:"#f59e0b",blue:"#3b82f6",green:"#22c55e",white:"#f1f5f9" };
  return (
    <div style={{ padding:"11px 16px", borderBottom:"1px solid rgba(148,163,184,0.07)" }}>
      <p style={{ fontSize:11, color:"#64748b", margin:"0 0 2px", letterSpacing:"0.04em", textTransform:"uppercase" }}>{label}</p>
      <p style={{ fontSize:17, fontWeight:600, margin:0, color:colors[color]||"#f1f5f9", fontVariantNumeric:"tabular-nums" }}>{value ?? "—"}</p>
    </div>
  );
}

export default function App() {
  const { frame, status } = useSimWS();
  const ic = frame?.interceptor || {};
  const int = frame?.intercept || {};
  const st = frame?.stats || {};
  const statusColor = { online:"#22c55e", connecting:"#f59e0b", reconnecting:"#f59e0b", error:"#ef4444" };
  const icCol = { ENGAGE:"red",ARM:"amber",PURSUIT:"amber",TRACK:"blue",PATROL:"green",INTERCEPTED:"blue" };
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px", height:56, borderBottom:"1px solid rgba(148,163,184,0.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:6, background:"#1e3a5f", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="#60a5fa" strokeWidth="1.5" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="#60a5fa"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:600, margin:0 }}>SkySentry</p>
            <p style={{ fontSize:11, color:"#475569", margin:0 }}>Aerial Defence System</p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:statusColor[status]||"#64748b" }}/>
            <span style={{ fontSize:12, color:"#94a3b8", textTransform:"capitalize" }}>{status}</span>
          </div>
          <Badge label="YOLO26" color="blue"/>
          <Badge label="Live" color="green"/>
          {frame && <span style={{ fontSize:11, color:"#334155", fontVariantNumeric:"tabular-nums" }}>#{frame.frame}</span>}
        </div>
      </div>
      <div style={{ display:"flex", flex:1 }}>
        <div style={{ flex:1, padding:20, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ fontSize:13, fontWeight:500, margin:0, color:"#94a3b8" }}>Airspace Monitor</p>
              <p style={{ fontSize:11, color:"#475569", margin:"2px 0 0" }}>Restricted zone · Real-time tracking</p>
            </div>
            <div style={{ display:"flex", gap:16, fontSize:11, color:"#475569" }}>
              <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#ef4444", marginRight:4 }}/>Threat</span>
              <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#f59e0b", marginRight:4 }}/>Warning</span>
              <span><span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#3b82f6", marginRight:4 }}/>Interceptor</span>
            </div>
          </div>
          <div style={{ background:"#0f172a", border:"1px solid rgba(148,163,184,0.1)", borderRadius:10, overflow:"hidden" }}>
            <RadarCanvas frame={frame} width={740} height={500}/>
          </div>
          {(frame?.threats||[]).length > 0 && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {frame.threats.map(d => (
                <div key={d.id} style={{ background:"#1e293b", border:`1px solid ${d.id===frame.target_id?"rgba(59,130,246,0.4)":"rgba(148,163,184,0.08)"}`, borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:THREAT_COLOR[d.level], flexShrink:0 }}/>
                  <div>
                    <p style={{ fontSize:12, fontWeight:500, margin:0, color:"#e2e8f0" }}>{d.label}</p>
                    <p style={{ fontSize:11, color:"#64748b", margin:"1px 0 0" }}>{d.alt}m · conf {d.conf}</p>
                  </div>
                  {d.id===frame.target_id && <Badge label="Target" color="blue"/>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ width:220, borderLeft:"1px solid rgba(148,163,184,0.08)", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(148,163,184,0.08)" }}>
            <p style={{ fontSize:11, fontWeight:500, color:"#475569", margin:0, letterSpacing:"0.06em", textTransform:"uppercase" }}>Interceptor</p>
          </div>
          <Stat label="Status" value={ic.status||"—"} color={icCol[ic.status]||"white"}/>
          <Stat label="Position" value={ic.x!=null?`${Math.round(ic.x)}, ${Math.round(ic.y)}`:"—"}/>
          <Stat label="Heading" value={ic.heading!=null?`${ic.heading.toFixed(1)}°`:"—"}/>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(148,163,184,0.08)", marginTop:8 }}>
            <p style={{ fontSize:11, fontWeight:500, color:"#475569", margin:0, letterSpacing:"0.06em", textTransform:"uppercase" }}>Intercept</p>
          </div>
          <Stat label="Distance" value={int.distance!=null?`${Math.round(int.distance)} px`:"—"}/>
          <Stat label="ETA" value={int.eta!=null?`${int.eta.toFixed(1)} s`:"—"} color={int.eta<5?"red":int.eta<15?"amber":"white"}/>
          <Stat label="Guidance" value={int.status||"—"}/>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(148,163,184,0.08)", marginTop:8 }}>
            <p style={{ fontSize:11, fontWeight:500, color:"#475569", margin:0, letterSpacing:"0.06em", textTransform:"uppercase" }}>Threats</p>
          </div>
          <Stat label="Total" value={st.total_threats??0}/>
          <Stat label="Hostile" value={st.threat_count??0} color={st.threat_count>0?"red":"white"}/>
          <Stat label="Warning" value={st.warn_count??0} color={st.warn_count>0?"amber":"white"}/>
          <Stat label="Engaged" value={st.engaged?"Yes":"No"} color={st.engaged?"red":"green"}/>
          <div style={{ marginTop:"auto", padding:14, borderTop:"1px solid rgba(148,163,184,0.08)" }}>
            <p style={{ fontSize:10, color:"#334155", margin:0, lineHeight:1.6 }}>YOLO26 · NMS-free · STAL<br/>Proportional Navigation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
