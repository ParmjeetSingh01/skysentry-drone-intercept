import{useState,useRef}from'react';
const API=process.env.REACT_APP_API_URL||'http://localhost:8000';
const M='"Share Tech Mono",monospace';
export default function ImageDetect(){
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);
  const[drag,setDrag]=useState(false);
  const[error,setError]=useState('');
  const inp=useRef(null);
  async function upload(file){
    if(!file)return;
    setLoading(true);setError('');setResult(null);
    const fd=new FormData();fd.append('file',file);
    try{
      const r=await fetch(API+'/detect/image',{method:'POST',body:fd});
      const d=await r.json();
      if(d.error)setError(d.error);else setResult(d);
    }catch(e){setError('Cannot reach backend. Make sure it is running.');}
    setLoading(false);
  }
  const box={padding:16,border:'1px solid rgba(59,130,246,0.12)',borderRadius:6,background:'rgba(59,130,246,0.02)'};
  const lbl={color:'rgba(59,130,246,0.45)',fontSize:10,letterSpacing:2,textTransform:'uppercase'};
  return <div style={{display:'flex',flexDirection:'column',gap:20,fontFamily:M}}>
    <div
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);upload(e.dataTransfer.files[0]);}}
      onClick={()=>inp.current?.click()}
      style={{...box,border:'2px dashed '+(drag?'#60a5fa':'rgba(59,130,246,0.25)'),cursor:'pointer',textAlign:'center',padding:48,transition:'all .2s'}}>
      <div style={{fontSize:40,marginBottom:12}}>📁</div>
      <div style={{color:'#60a5fa',fontSize:13,letterSpacing:1}}>DROP IMAGE OR CLICK TO UPLOAD</div>
      <div style={{color:'rgba(0,255,100,0.4)',fontSize:11,marginTop:6}}>JPG · PNG · BMP · WEBP</div>
      <input ref={inp} type="file" accept="image/*" style={{display:'none'}} onChange={e=>upload(e.target.files[0])}/>
    </div>
    {loading&&<div style={{textAlign:'center',color:'#60a5fa',letterSpacing:2,animation:'pulse 1s infinite'}}>⚙ RUNNING YOLO DETECTION...</div>}
    {error&&<div style={{color:'#ff3b30',fontSize:12,padding:12,border:'1px solid rgba(255,59,48,0.3)',borderRadius:4}}>{error}</div>}
    {result&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {[{l:'File',v:result.filename},{l:'Resolution',v:result.shape?result.shape[1]+'x'+result.shape[0]:'—'},{l:'Detections',v:result.count},{l:'Classes',v:[...new Set((result.detections||[]).map(d=>d.class))].join(', ')||'none'}].map(({l,v})=>(
          <div key={l} style={{...box,flex:1,minWidth:110}}>
            <div style={lbl}>{l}</div>
            <div style={{color:'#60a5fa',fontSize:15,fontWeight:'bold',marginTop:4}}>{v}</div>
          </div>
        ))}
      </div>
      {result.annotated_b64&&<div>
        <div style={{...lbl,marginBottom:8}}>ANNOTATED OUTPUT</div>
        <img src={'data:image/jpeg;base64,'+result.annotated_b64} alt="annotated" style={{width:'100%',borderRadius:4,border:'1px solid rgba(59,130,246,0.15)'}}/>
      </div>}
      {result.detections?.length>0&&<div>
        <div style={{...lbl,marginBottom:8}}>DETECTION TABLE</div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['#','Class','Conf','BBox','Center'].map(h=><th key={h} style={{...lbl,padding:'4px 8px',textAlign:'left',borderBottom:'1px solid rgba(0,255,100,0.1)'}}>{h}</th>)}</tr></thead>
          <tbody>{result.detections.map((d,i)=>(
            <tr key={i} style={{borderBottom:'1px solid rgba(59,130,246,0.04)'}}>
              <td style={{color:'rgba(59,130,246,0.5)',fontFamily:M,fontSize:11,padding:'5px 8px'}}>{i+1}</td>
              <td style={{color:'#ff9f0a',fontFamily:M,fontSize:11,padding:'5px 8px',fontWeight:'bold'}}>{d.class}</td>
              <td style={{color:'#60a5fa',fontFamily:M,fontSize:11,padding:'5px 8px'}}>{(d.conf*100).toFixed(1)}%</td>
              <td style={{color:'rgba(0,255,100,0.7)',fontFamily:M,fontSize:10,padding:'5px 8px'}}>{d.bbox?.join(', ')}</td>
              <td style={{color:'#00d4ff',fontFamily:M,fontSize:11,padding:'5px 8px'}}>({d.center?.[0]}, {d.center?.[1]})</td>
            </tr>
          ))}</tbody>
        </table>
      </div>}
    </div>}
  </div>;
}
