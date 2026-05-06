import{useState,useEffect,useRef}from'react';
const RAW=process.env.REACT_APP_API_URL||'http://localhost:8000';
const WSS=RAW.replace(/^https/,'wss').replace(/^http/,'ws');
const M='"Share Tech Mono",monospace';

export default function WebcamDetect(){
  const[active,setActive]=useState(false);
  const[result,setResult]=useState(null);
  const[error,setError]=useState('');
  const[fps,setFps]=useState(0);
  const[total,setTotal]=useState(0);
  const videoRef=useRef(null);
  const captureRef=useRef(null);  // hidden capture canvas
  const displayRef=useRef(null);  // visible display canvas
  const wsRef=useRef(null);
  const streamRef=useRef(null);
  const timerRef=useRef(null);
  const fpsData=useRef({count:0,ts:Date.now()});
  const waitingRef=useRef(false);  // only send next frame after reply

  async function start(){
    setError('');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{width:{ideal:640},height:{ideal:480},facingMode:'environment'}
      });
      streamRef.current=stream;
      const video=videoRef.current;
      video.srcObject=stream;
      video.playsInline=true;
      video.muted=true;
      await video.play();

      const ws=new WebSocket(WSS+'/ws/webcam');
      wsRef.current=ws;

      ws.onopen=()=>{
        setActive(true);
        // Start capture loop after WS open
        timerRef.current=setInterval(()=>{
          if(waitingRef.current)return;  // don't flood backend
          const v=videoRef.current;
          const c=captureRef.current;
          if(!v||!c||v.readyState<2||v.videoWidth===0)return;
          c.width=v.videoWidth;
          c.height=v.videoHeight;
          c.getContext('2d').drawImage(v,0,0);
          const b64=c.toDataURL('image/jpeg',0.72).split(',')[1];
          if(ws.readyState===1){
            waitingRef.current=true;
            ws.send(JSON.stringify({frame:b64}));
          }
        },150);
      };

      ws.onmessage=e=>{
        waitingRef.current=false;
        try{
          const d=JSON.parse(e.data);
          setResult(d);
          setTotal(t=>t+d.count);
          fpsData.current.count++;
          const now=Date.now(),dt=(now-fpsData.current.ts)/1000;
          if(dt>0.8){
            setFps(Math.round(fpsData.current.count/dt));
            fpsData.current.count=0;fpsData.current.ts=now;
          }
          // Draw annotated frame on display canvas
          if(d.annotated){
            const img=new Image();
            img.onload=()=>{
              const dc=displayRef.current;
              if(!dc)return;
              dc.width=img.width;dc.height=img.height;
              dc.getContext('2d').drawImage(img,0,0);
            };
            img.src='data:image/jpeg;base64,'+d.annotated;
          } else {
            // No YOLO on server — just mirror the raw frame
            const v=videoRef.current;const dc=displayRef.current;
            if(v&&dc&&v.readyState>=2){
              dc.width=v.videoWidth;dc.height=v.videoHeight;
              dc.getContext('2d').drawImage(v,0,0);
            }
          }
        }catch{}
      };

      ws.onerror=()=>setError('WebSocket error — is backend running?');
      ws.onclose=()=>{if(active)setError('Connection closed');};

    }catch(e){
      setError('Webcam access denied: '+e.message);
    }
  }

  function stop(){
    clearInterval(timerRef.current);
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    waitingRef.current=false;
    setActive(false);setResult(null);setFps(0);
  }

  useEffect(()=>()=>stop(),[]);

  const threatColor=result?.count>0?'#ff3b30':'#60a5fa';

  return <div style={{display:'flex',flexDirection:'column',gap:16,fontFamily:M}}>
    {/* Controls */}
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      {!active
        ?<button onClick={start} style={{padding:'10px 28px',border:'1px solid #00ff64',background:'rgba(59,130,246,0.08)',color:'#60a5fa',borderRadius:3,cursor:'pointer',fontFamily:M,fontSize:12,letterSpacing:2}}>▶ START WEBCAM</button>
        :<button onClick={stop} style={{padding:'10px 28px',border:'1px solid #ff3b30',background:'rgba(255,59,48,0.08)',color:'#ff3b30',borderRadius:3,cursor:'pointer',fontFamily:M,fontSize:12,letterSpacing:2}}>■ STOP</button>
      }
      {[{l:'FPS',v:fps,alert:false},{l:'Live Detections',v:result?.count??0,alert:(result?.count??0)>0},{l:'Total Detected',v:total,alert:false}].map(({l,v,alert})=>(
        <div key={l} style={{padding:'8px 16px',border:'1px solid rgba(59,130,246,0.12)',borderRadius:3,background:'rgba(59,130,246,0.02)'}}>
          <div style={{fontSize:9,color:'rgba(0,255,100,0.4)',letterSpacing:2}}>{l}</div>
          <div style={{fontSize:15,color:alert?'#ff3b30':'#60a5fa',fontFamily:M,fontWeight:'bold'}}>{v}</div>
        </div>
      ))}
    </div>

    {error&&<div style={{color:'#ff3b30',fontSize:12,padding:12,border:'1px solid rgba(255,59,48,0.3)',borderRadius:4}}>{error}</div>}

    {/* Video display */}
    <div style={{position:'relative',borderRadius:6,overflow:'hidden',border:'2px solid '+(active?threatColor:'rgba(59,130,246,0.15)'),background:'#080d1a',minHeight:360,display:'flex',alignItems:'center',justifyContent:'center'}}>
      {/* Hidden elements for capture */}
      <video ref={videoRef} muted playsInline style={{position:'absolute',width:1,height:1,opacity:0,pointerEvents:'none'}}/>
      <canvas ref={captureRef} style={{display:'none'}}/>
      {/* Visible annotated canvas */}
      <canvas ref={displayRef} style={{width:'100%',display:active?'block':'none'}}/>
      {!active&&<div style={{textAlign:'center',color:'rgba(59,130,246,0.3)',letterSpacing:2,fontSize:13,padding:40}}>
        <div style={{fontSize:52,marginBottom:12}}>📷</div>
        WEBCAM OFFLINE
        <div style={{fontSize:11,marginTop:8,color:'rgba(0,255,100,0.2)'}}>Allow camera access when prompted</div>
      </div>}
      {/* Status badge */}
      {active&&<div style={{position:'absolute',top:10,left:10,padding:'4px 12px',border:'1px solid '+(result?.count>0?'#ff3b30':'#34c759'),borderRadius:2,background:result?.count>0?'rgba(255,59,48,0.15)':'rgba(52,199,89,0.1)',color:result?.count>0?'#ff3b30':'#34c759',fontSize:11,letterSpacing:1,fontWeight:'bold',fontFamily:M,animation:result?.count>0?'pulse .8s infinite':'none'}}>
        {result?.count>0?result.count+' THREAT'+(result.count>1?'S':'')+' DETECTED':'NO THREATS'}
      </div>}
      {/* FPS badge */}
      {active&&<div style={{position:'absolute',top:10,right:10,padding:'4px 12px',border:'1px solid rgba(59,130,246,0.3)',borderRadius:2,background:'rgba(0,0,0,0.5)',color:'#60a5fa',fontSize:11,fontFamily:M}}>
        {fps} FPS
      </div>}
    </div>

    {/* Detection list */}
    {result?.detections?.length>0&&<div style={{padding:14,border:'1px solid rgba(59,130,246,0.12)',borderRadius:4,background:'rgba(0,0,0,0.3)'}}>
      <div style={{fontSize:10,color:'rgba(0,255,100,0.4)',letterSpacing:2,marginBottom:10}}>LIVE DETECTIONS</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr>{['Class','Confidence','Center','BBox'].map(h=><th key={h} style={{color:'rgba(0,255,100,0.4)',fontSize:10,letterSpacing:2,padding:'3px 8px',textAlign:'left',borderBottom:'1px solid rgba(0,255,100,0.1)'}}>{h}</th>)}</tr></thead>
        <tbody>{result.detections.map((d,i)=>(
          <tr key={i} style={{borderBottom:'1px solid rgba(59,130,246,0.04)'}}>
            <td style={{color:'#ff9f0a',fontFamily:M,fontSize:12,padding:'5px 8px',fontWeight:'bold'}}>{d.class?.toUpperCase()}</td>
            <td style={{color:'#60a5fa',fontFamily:M,fontSize:12,padding:'5px 8px'}}>{(d.conf*100).toFixed(1)}%</td>
            <td style={{color:'#00d4ff',fontFamily:M,fontSize:11,padding:'5px 8px'}}>({d.center?.[0]}, {d.center?.[1]})</td>
            <td style={{color:'rgba(59,130,246,0.5)',fontFamily:M,fontSize:10,padding:'5px 8px'}}>{d.bbox?.join(', ')}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>}
  </div>;
}
