import{useState,useEffect,useRef,useCallback}from'react';
const RAW=process.env.REACT_APP_API_URL||'http://localhost:8000';
const WSS=RAW.replace(/^https/,'wss').replace(/^http/,'ws');
export function useSimWS(){
  const[data,setData]=useState(null);
  const[connected,setConnected]=useState(false);
  const wsRef=useRef(null);
  useEffect(()=>{
    let ws,rt;
    function connect(){
      ws=new WebSocket(WSS+'/ws/sim');wsRef.current=ws;
      ws.onopen=()=>setConnected(true);
      ws.onmessage=e=>{try{setData(JSON.parse(e.data));}catch{}};
      ws.onerror=()=>{};
      ws.onclose=()=>{setConnected(false);rt=setTimeout(connect,3000);};
    }
    connect();return()=>{clearTimeout(rt);ws?.close();};
  },[]);
  const send=useCallback(a=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify({action:a}));},[]);
  return{data,connected,send};
}
