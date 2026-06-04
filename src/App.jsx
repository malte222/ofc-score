import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const RANK_VAL = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const SUITS_LIST = ["♠","♥","♦","♣"];
const SUIT_CODES = {s:"♠",h:"♥",d:"♦",c:"♣"};
const SUIT_COLORS = {"♠":"#1a1a2e","♥":"#c0392b","♦":"#c0392b","♣":"#1a1a2e"};
const BOTTOM_ROYALTIES={Straight:2,Flush:4,"Full House":6,"Four of a Kind":10,"Straight Flush":15,"Royal Flush":25};
const MIDDLE_ROYALTIES={"Three of a Kind":2,Straight:4,Flush:8,"Full House":12,"Four of a Kind":20,"Straight Flush":30,"Royal Flush":50};
const TOP_ROYALTIES={"66":1,"77":2,"88":3,"99":4,"TT":5,"JJ":6,"QQ":7,"KK":8,"AA":9,"222":10,"333":11,"444":12,"555":13,"666":14,"777":15,"888":16,"999":17,"TTT":18,"JJJ":19,"QQQ":20,"KKK":21,"AAA":22};
const FL_TOP_QUALIFIERS=["QQ","KK","AA","222","333","444","555","666","777","888","999","TTT","JJJ","QQQ","KKK","AAA"];

// ─── Hand Evaluator ───────────────────────────────────────────────────────────
function parseCard(str){
  if(!str||str.length<2)return null;
  const rank=str.slice(0,-1),suit=str.slice(-1),val=RANK_VAL[rank];
  if(val===undefined)return null;
  return{rank,suit,val};
}
function countBy(arr){return arr.reduce((a,v)=>{a[v]=(a[v]||0)+1;return a;},{});}
function isSequential(vals){const s=[...new Set(vals)].sort((a,b)=>b-a);if(s.length<5)return false;return s[0]-s[4]===4;}
function evalHand(cards){
  if(!cards||cards.length===0)return{name:"High Card",rank:0,tiebreakers:[]};
  const valid=cards.filter(c=>c&&c.val!==undefined&&!isNaN(c.val));
  if(valid.length===0)return{name:"High Card",rank:0,tiebreakers:[]};
  const sorted=[...valid].sort((a,b)=>b.val-a.val);
  const vals=sorted.map(c=>c.val),suits=sorted.map(c=>c.suit),n=valid.length;
  if(n===3){
    const counts=countBy(vals);
    const trips=Object.entries(counts).filter(e=>e[1]>=3).map(e=>+e[0]);
    const pairs=Object.entries(counts).filter(e=>e[1]>=2).map(e=>+e[0]);
    if(trips.length)return{name:"Three of a Kind",rank:7,trips:trips[0],tiebreakers:[trips[0]]};
    if(pairs.length){const pv=Math.max(...pairs),k=vals.find(v=>v!==pv);return{name:"Pair",rank:2,pair:pv,tiebreakers:k!==undefined?[pv,k]:[pv]};}
    return{name:"High Card",rank:1,high:vals[0],tiebreakers:vals};
  }
  const isFlush=new Set(suits).size===1,ws=vals.slice(0,5).join(",")===("14,5,4,3,2"),isSt=isSequential(vals)||ws;
  const counts=countBy(vals),groups=Object.entries(counts).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const g0=groups[0]||[],g1=groups[1]||[];
  if(isFlush&&isSt){if(vals[0]===14&&vals[1]===13&&!ws)return{name:"Royal Flush",rank:10,tiebreakers:[14]};return{name:"Straight Flush",rank:9,tiebreakers:[ws?5:vals[0]]};}
  if(g0[1]===4)return{name:"Four of a Kind",rank:8,quad:+g0[0],tiebreakers:[+g0[0],...(g1[0]?[+g1[0]]:[]) ]};
  if(g0[1]===3&&g1[1]>=2)return{name:"Full House",rank:7,trips:+g0[0],pair:+g1[0],tiebreakers:[+g0[0],+g1[0]]};
  if(isFlush)return{name:"Flush",rank:6,tiebreakers:vals};
  if(isSt)return{name:"Straight",rank:5,high:ws?5:vals[0],tiebreakers:[ws?5:vals[0]]};
  if(g0[1]===3){const k=vals.filter(v=>v!==+g0[0]);return{name:"Three of a Kind",rank:4,trips:+g0[0],tiebreakers:[+g0[0],...k]};}
  if(g0[1]===2&&g1[1]===2){const pv=[+g0[0],+g1[0]].sort((a,b)=>b-a),k=vals.find(v=>v!==pv[0]&&v!==pv[1]);return{name:"Two Pair",rank:3,pairs:pv,tiebreakers:k!==undefined?[...pv,k]:pv};}
  if(g0[1]===2){const k=vals.filter(v=>v!==+g0[0]);return{name:"One Pair",rank:2,pair:+g0[0],tiebreakers:[+g0[0],...k]};}
  return{name:"High Card",rank:1,high:vals[0],tiebreakers:vals};
}
function compareHands(h1,h2){
  if(h1.rank!==h2.rank)return h1.rank-h2.rank;
  const t1=h1.tiebreakers||[],t2=h2.tiebreakers||[];
  for(let i=0;i<Math.max(t1.length,t2.length);i++){const a=t1[i]!==undefined?t1[i]:0,b=t2[i]!==undefined?t2[i]:0;if(a!==b)return a-b;}
  return 0;
}
function parsedCards(row){return row.filter(Boolean).map(parseCard).filter(Boolean);}
function isFouled(board){
  if(parsedCards(board.top).length<3||parsedCards(board.middle).length<5||parsedCards(board.bottom).length<5)return false;
  const top=evalHand(parsedCards(board.top)),mid=evalHand(parsedCards(board.middle)),bot=evalHand(parsedCards(board.bottom));
  return compareHands(bot,mid)<0||compareHands(mid,top)<0;
}
function getTopRoyalty(board){const c=parsedCards(board.top);if(c.length<3)return 0;const h=evalHand(c);if(h.name==="Three of a Kind"&&!isNaN(h.trips)){const r=RANKS[h.trips-2];return r?TOP_ROYALTIES[r.repeat(3)]||0:0;}if(h.name==="Pair"&&!isNaN(h.pair)){const r=RANKS[h.pair-2];return r?TOP_ROYALTIES[r.repeat(2)]||0:0;}return 0;}
function getMidRoyalty(board){const c=parsedCards(board.middle);if(c.length<5)return 0;return MIDDLE_ROYALTIES[evalHand(c).name]||0;}
function getBotRoyalty(board){const c=parsedCards(board.bottom);if(c.length<5)return 0;return BOTTOM_ROYALTIES[evalHand(c).name]||0;}
function getTotalRoyalties(board){if(isFouled(board))return 0;return getTopRoyalty(board)+getMidRoyalty(board)+getBotRoyalty(board);}
function qualifiesFL(board){
  if(isFouled(board))return false;
  const c=parsedCards(board.top);if(c.length<3)return false;
  const h=evalHand(c);
  if(h.name==="Pair"&&!isNaN(h.pair)){const r=RANKS[h.pair-2];return r?FL_TOP_QUALIFIERS.includes(r.repeat(2)):false;}
  return h.name==="Three of a Kind";
}
function compareRowHands(r1,r2){const d=compareHands(evalHand(parsedCards(r1)),evalHand(parsedCards(r2)));return d>0?1:d<0?-1:0;}
function calcPoints(boards,forcedFouls){
  const n=boards.length;
  const fouled=boards.map((b,i)=>forcedFouls[i]||isFouled(b));
  const royalties=boards.map((b,i)=>fouled[i]?0:getTotalRoyalties(b));
  const delta=new Array(n).fill(0);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    const fi=fouled[i],fj=fouled[j];
    if(fi&&fj)continue;
    if(fi){delta[i]-=6;delta[j]+=6;continue;}
    if(fj){delta[i]+=6;delta[j]-=6;continue;}
    const tc=compareRowHands(boards[i].top,boards[j].top),mc=compareRowHands(boards[i].middle,boards[j].middle),bc=compareRowHands(boards[i].bottom,boards[j].bottom);
    let iW=0,jW=0;
    if(tc>0)iW++;else if(tc<0)jW++;
    if(mc>0)iW++;else if(mc<0)jW++;
    if(bc>0)iW++;else if(bc<0)jW++;
    let pts=iW-jW;if(iW===3)pts+=3;if(jW===3)pts-=3;
    delta[i]+=pts;delta[j]-=pts;
  }
  for(let i=0;i<n;i++){const r=royalties[i];if(r>0){delta[i]+=r*(n-1);for(let j=0;j<n;j++)if(j!==i)delta[j]-=r;}}
  return{delta,royalties,fouled};
}

// ─── Gemini API ───────────────────────────────────────────────────────────────
function getApiKey(){let key=localStorage.getItem("gemini_api_key");if(!key){key=prompt("Bitte gib deinen Google Gemini API-Key ein:");if(key)localStorage.setItem("gemini_api_key",key);}return key;}
async function recognizeAllBoards(images){
  const apiKey=getApiKey();if(!apiKey)return null;
  const valid=images.filter(Boolean);const n=valid.length;if(n===0)return null;
  const prompt=`Du bist ein Experte für OFC Poker Kartenerkennung. Du erhältst ${n} Bild(er), jedes zeigt ein OFC-Board (Top:3, Middle:5, Bottom:5 Karten). Antworte NUR mit JSON-Array mit ${n} Objekten. Format: Wert+Farbe (A/K/Q/J/T/9-2 + s/h/d/c), "10"→"T", unerkennbar→"". [{"top":["Ah","Kd","7s"],"middle":["Ts","9h","8d","7c","6s"],"bottom":["As","Ad","Ac","Kh","Ks"]}]`;
  const parts=[{text:prompt}];
  for(const img of valid)parts.push({inline_data:{mime_type:img.mimeType,data:img.base64}});
  try{
    const resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts}],generationConfig:{responseMimeType:"application/json"}})});
    const data=await resp.json();
    if(data.error){alert("Gemini Fehler: "+data.error.message);return null;}
    let text=data.candidates[0].content.parts[0].text.replace(/```json/gi,"").replace(/```/gi,"").trim();
    const parsed=JSON.parse(text);return Array.isArray(parsed)?parsed:[parsed];
  }catch(err){alert("Fehler: "+err.message);return null;}
}
function normalizeCard(c){
  if(!c||c==="??"||c==="")return"";
  const s=String(c).trim();if(s.length<2)return"";
  const sm={s:"♠",h:"♥",d:"♦",c:"♣",S:"♠",H:"♥",D:"♦",C:"♣"};
  let rank=s.slice(0,-1).toUpperCase();if(rank==="10")rank="T";
  return rank+(sm[s.slice(-1)]||s.slice(-1));
}

// ─── Storage ─────────────────────────────────────────────────────────────────
function loadData(){try{return{players:JSON.parse(localStorage.getItem("ofc:players")||"[]"),sessions:JSON.parse(localStorage.getItem("ofc:sessions")||"[]")};}catch{return{players:[],sessions:[]};}}
function saveData(p,s){try{localStorage.setItem("ofc:players",JSON.stringify(p));localStorage.setItem("ofc:sessions",JSON.stringify(s));}catch(e){}}

// ─── SVG Card Component ───────────────────────────────────────────────────────
function CardSvg({rank,suit,width=38,height=54}){
  const color=SUIT_COLORS[suit]||"#1a1a2e";
  const rankDisplay=rank==="T"?"10":rank;
  return(
    <svg width={width} height={height} viewBox="0 0 38 54" xmlns="http://www.w3.org/2000/svg" style={{display:"block",flexShrink:0}}>
      <rect x="0.5" y="0.5" width="37" height="53" rx="4" fill="white" stroke="#d0d0d0" strokeWidth="1"/>
      <text x="4" y="14" fontSize="11" fontWeight="700" fill={color} fontFamily="Georgia,serif">{rankDisplay}</text>
      <text x="19" y="32" fontSize="18" textAnchor="middle" dominantBaseline="middle" fill={color} fontFamily="Georgia,serif">{suit}</text>
      <text x="34" y="48" fontSize="11" fontWeight="700" fill={color} fontFamily="Georgia,serif" textAnchor="end" transform="rotate(180,34,48)">{rankDisplay}</text>
    </svg>
  );
}

// ─── Card Picker Modal ────────────────────────────────────────────────────────
function CardPickerModal({usedCards,onSelect,onClose}){
  const [selectedRank,setSelectedRank]=useState(null);
  const usedSet=new Set(usedCards.filter(Boolean));

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"var(--color-background-primary)",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:520,padding:"16px",maxHeight:"75vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <span style={{fontWeight:600,fontSize:15}}>Karte auswählen</span>
          <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:20,color:"var(--color-text-secondary)"}}>✕</button>
        </div>
        {/* Rank selector */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {RANKS.slice().reverse().map(r=>(
            <button key={r} onClick={()=>setSelectedRank(r===selectedRank?null:r)}
              style={{padding:"6px 10px",borderRadius:8,border:"none",fontWeight:600,fontSize:14,cursor:"pointer",
                background:selectedRank===r?"var(--color-background-info)":"var(--color-background-secondary)",
                color:selectedRank===r?"var(--color-text-info)":"var(--color-text-primary)"}}>
              {r==="T"?"10":r}
            </button>
          ))}
        </div>
        {/* Suit selector — only shown after rank picked */}
        {selectedRank&&(
          <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:8}}>
            {SUITS_LIST.map(suit=>{
              const cardStr=selectedRank+suit;
              const used=usedSet.has(cardStr);
              return(
                <button key={suit} onClick={()=>{if(!used){onSelect(cardStr);onClose();}}}
                  disabled={used}
                  style={{padding:"10px 18px",borderRadius:10,border:"1px solid #ddd",background:used?"#f5f5f5":"white",cursor:used?"not-allowed":"pointer",opacity:used?0.4:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontSize:28,color:SUIT_COLORS[suit]}}>{suit}</span>
                  <span style={{fontSize:12,fontWeight:600,color:SUIT_COLORS[suit]}}>{selectedRank==="T"?"10":selectedRank}{suit}</span>
                  {used&&<span style={{fontSize:10,color:"#999"}}>vergeben</span>}
                </button>
              );
            })}
          </div>
        )}
        {!selectedRank&&<p style={{textAlign:"center",color:"var(--color-text-secondary)",fontSize:13,marginTop:4}}>Wähle zuerst den Kartenwert oben.</p>}
      </div>
    </div>
  );
}

// ─── BoardEditor ─────────────────────────────────────────────────────────────
// Card size scale
const CS=0.8; // 80% of original size
const CW=Math.round(38*CS); // ~30px
const CH=Math.round(54*CS); // ~43px

function CardSlotSmall({value,onChange,allBoardCards}){
  const [open,setOpen]=useState(false);
  const parsed=value?parseCard(value):null;
  return(
    <>
      <div onClick={()=>setOpen(true)}
        style={{width:CW,height:CH,borderRadius:4,border:"1px solid #bbb",background:"white",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}}>
        {parsed?(
          <CardSvg rank={parsed.rank} suit={parsed.suit} width={CW} height={CH}/>
        ):(
          <span style={{color:"#bbb",fontSize:16,fontWeight:300}}>+</span>
        )}
      </div>
      {open&&(
        <CardPickerModal
          usedCards={allBoardCards}
          onSelect={v=>{onChange(v);setOpen(false);}}
          onClose={()=>setOpen(false)}/>
      )}
    </>
  );
}

function BoardEditor({board,onChange,label,fouled,royalty,fl,isForcedFoul}){
  const updateRow=(row,idx,val)=>onChange({...board,[row]:board[row].map((c,i)=>i===idx?val:c)});
  // collect all placed cards for "used" detection
  const allCards=[...board.top,...board.middle,...board.bottom].filter(Boolean);

  const rowDef=[{key:"top",count:3},{key:"middle",count:5},{key:"bottom",count:5}];
  const getHandName=(key,count)=>{const f=board[key].filter(Boolean);if(f.length<count)return"";return evalHand(f.map(parseCard).filter(Boolean)).name;};

  if(isForcedFoul)return(
    <div style={{border:"1.5px solid var(--color-border-danger)",borderRadius:10,padding:"10px 14px",marginBottom:6,background:"var(--color-background-primary)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontWeight:600,fontSize:14}}>{label}</span>
        <span style={{background:"var(--color-background-danger)",color:"var(--color-text-danger)",fontSize:11,padding:"2px 10px",borderRadius:8,fontWeight:500}}>Foul</span>
      </div>
      <p style={{fontSize:11,color:"var(--color-text-secondary)",marginTop:6,marginBottom:0}}>Karten werden nicht gewertet.</p>
    </div>
  );

  return(
    <div style={{border:fouled?"1.5px solid var(--color-border-danger)":"1px solid var(--color-border-tertiary)",borderRadius:10,padding:"10px 14px",marginBottom:6,background:"var(--color-background-primary)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontWeight:600,fontSize:14}}>{label}</span>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {fl&&<span style={{background:"var(--color-background-success)",color:"var(--color-text-success)",fontSize:10,padding:"2px 7px",borderRadius:8}}>FL</span>}
          {fouled&&<span style={{background:"var(--color-background-danger)",color:"var(--color-text-danger)",fontSize:10,padding:"2px 7px",borderRadius:8}}>Fouled</span>}
          {royalty>0&&<span style={{background:"var(--color-background-warning)",color:"var(--color-text-warning)",fontSize:10,padding:"2px 7px",borderRadius:8}}>+{royalty}R</span>}
        </div>
      </div>
      {/* Rows */}
      {rowDef.map(({key,count})=>(
        <div key={key} style={{marginBottom:5}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{display:"flex",gap:4}}>
              {Array.from({length:count}).map((_,i)=>(
                <CardSlotSmall key={i} value={board[key][i]||""} onChange={v=>updateRow(key,i,v)} allBoardCards={allCards}/>
              ))}
            </div>
            <span style={{fontSize:10,color:"var(--color-text-tertiary)",marginLeft:4,whiteSpace:"nowrap"}}>{getHandName(key,count)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── In-App Camera ───────────────────────────────────────────────────────────
function InAppCamera({onCapture,onCancel}){
  const videoRef=useRef(),streamRef=useRef(),containerRef=useRef();
  const [ready,setReady]=useState(false);
  const [camError,setCamError]=useState(null);
  const [facingMode,setFacingMode]=useState("environment");
  const [zoom,setZoom]=useState(1);
  const maxZoom=4,minZoom=1;
  const initialDistRef=useRef(null),initialZoomRef=useRef(1);
  const [torch,setTorch]=useState(false);
  const [hasTorch,setHasTorch]=useState(false);

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const prevent=e=>{if(e.touches.length>1)e.preventDefault();};
    el.addEventListener("touchmove",prevent,{passive:false});
    return()=>el.removeEventListener("touchmove",prevent);
  },[]);

  const startStream=useCallback(async(facing)=>{
    setTorch(false);setHasTorch(false);setZoom(1);
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    await new Promise(r=>setTimeout(r,150));
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:1920},height:{ideal:1080}},audio:false});
      streamRef.current=stream;
      if(videoRef.current){
        videoRef.current.srcObject=stream;
        videoRef.current.play().catch(()=>{});
        const vt=stream.getVideoTracks()[0];
        if(vt&&typeof vt.getCapabilities==="function"){const caps=vt.getCapabilities();if(caps.torch)setHasTorch(true);}
        setReady(true);setCamError(null);
      }
    }catch(err){if(err.name!=="AbortError")setCamError("Kamera-Zugriff verweigert. Bitte Berechtigung erteilen.");}
  },[]);

  useEffect(()=>{let m=true;if(m)startStream(facingMode);return()=>{m=false;if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}};},[facingMode,startStream]);

  const handleTouchStart=e=>{if(e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);initialDistRef.current=d;initialZoomRef.current=zoom;}};
  const handleTouchMove=e=>{if(e.touches.length===2&&initialDistRef.current!==null){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);let nz=initialZoomRef.current*(d/initialDistRef.current);setZoom(Math.max(minZoom,Math.min(maxZoom,nz)));}};
  const handleTouchEnd=()=>{initialDistRef.current=null;};

  const toggleTorch=()=>{const vt=streamRef.current&&streamRef.current.getVideoTracks()[0];if(vt&&hasTorch){const nt=!torch;vt.applyConstraints({advanced:[{torch:nt}]}).then(()=>setTorch(nt)).catch(()=>{});}};

  const shoot=()=>{
    const video=videoRef.current;if(!video)return;
    const w=video.videoWidth,h=video.videoHeight;
    const base=Math.min(w,h),crop=base/zoom;
    const x=(w-crop)/2,y=(h-crop)/2;
    const canvas=document.createElement("canvas");
    canvas.width=1080;canvas.height=1080;
    canvas.getContext("2d").drawImage(video,x,y,crop,crop,0,0,1080,1080);
    const dataUrl=canvas.toDataURL("image/jpeg",0.92);
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    onCapture(dataUrl);
  };

  return(
    <div ref={containerRef} style={{position:"fixed",inset:0,background:"#000",zIndex:300,display:"flex",flexDirection:"column",touchAction:"none"}} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {camError?(
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff",padding:"2rem",textAlign:"center",gap:16}}>
          <div style={{fontSize:48}}>📷</div>
          <div style={{fontSize:15}}>{camError}</div>
          <button onClick={onCancel} style={{padding:"10px 24px",borderRadius:10,border:"none",background:"rgba(255,255,255,0.2)",color:"#fff",fontSize:15,cursor:"pointer"}}>Abbrechen</button>
        </div>
      ):(
        <>
          <div style={{width:"100%",maxWidth:400,aspectRatio:"1/1",margin:"auto auto 0 auto",position:"relative",overflow:"hidden",background:"#000",border:"3px solid rgba(255,255,255,0.3)",borderRadius:16}}>
            <video ref={videoRef} playsInline muted autoPlay style={{width:"100%",height:"100%",objectFit:"cover",display:"block",transform:"scale("+zoom+")",transformOrigin:"center center",transition:"transform 0.05s ease-out"}}/>
            {["tl","tr","bl","br"].map(c=>(
              <div key={c} style={{position:"absolute",top:c.startsWith("t")?16:"auto",bottom:c.startsWith("b")?16:"auto",left:c.endsWith("l")?16:"auto",right:c.endsWith("r")?16:"auto",width:28,height:28,borderTop:c.startsWith("t")?"3px solid #fff":"none",borderBottom:c.startsWith("b")?"3px solid #fff":"none",borderLeft:c.endsWith("l")?"3px solid #fff":"none",borderRight:c.endsWith("r")?"3px solid #fff":"none"}}/>
            ))}
          </div>
          <div style={{width:"100%",maxWidth:400,margin:"0 auto auto auto",padding:"16px 16px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
            {/* Zoom slider with large thumb via inline style injection */}
            <style>{`
              .zoom-slider{-webkit-appearance:none;appearance:none;width:100%;height:8px;border-radius:4px;background:rgba(255,255,255,0.25);outline:none;accent-color:#3498db;}
              .zoom-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:32px;height:32px;border-radius:50%;background:#3498db;cursor:pointer;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);}
              .zoom-slider::-moz-range-thumb{width:32px;height:32px;border-radius:50%;background:#3498db;cursor:pointer;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);}
            `}</style>
            <div style={{width:"100%",display:"flex",alignItems:"center",gap:10,color:"#fff"}}>
              <span style={{fontSize:12,minWidth:32,color:"#95a5a6"}}>1×</span>
              <input type="range" className="zoom-slider" min={minZoom} max={maxZoom} step="0.05" value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))}/>
              <span style={{fontSize:14,fontWeight:"bold",minWidth:40,textAlign:"right",color:"#3498db"}}>{zoom.toFixed(1)}×</span>
            </div>
            <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <button onClick={toggleTorch} disabled={!hasTorch} style={{background:torch?"#f1c40f":"rgba(255,255,255,0.12)",border:"none",color:torch?"#000":"#fff",padding:"7px 14px",borderRadius:20,fontSize:13,fontWeight:600,cursor:hasTorch?"pointer":"not-allowed",opacity:hasTorch?1:0.4}}>
                💡 {hasTorch?(torch?"AN":"AUS"):"—"}
              </button>
              <span style={{color:"#7f8c8d",fontSize:11}}>Pinch zum Zoomen</span>
            </div>
          </div>
          <div style={{background:"#000",padding:"16px 32px 32px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <button onClick={onCancel} style={{background:"transparent",border:"none",color:"#7f8c8d",fontSize:15,cursor:"pointer",padding:"8px 12px"}}>Abbrechen</button>
            <button onClick={shoot} disabled={!ready} style={{width:72,height:72,borderRadius:"50%",border:"4px solid #fff",background:ready?"#fff":"rgba(255,255,255,0.3)",cursor:ready?"pointer":"not-allowed",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:ready?"#fff":"transparent",border:"2px solid #ccc"}}/>
            </button>
            <button onClick={()=>{setZoom(1);setFacingMode(f=>f==="environment"?"user":"environment");}} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:22}}>🔄</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Image Blackout Editor ────────────────────────────────────────────────────
function ImageBlackoutEditor({src,initialStrokes=[],onConfirm,onCancel}){
  const canvasRef=useRef(),imgRef=useRef();
  const [drawing,setDrawing]=useState(false);
  const [strokes,setStrokes]=useState(initialStrokes);
  const [currentStroke,setCurrentStroke]=useState([]);
  const [imgSize,setImgSize]=useState({w:0,h:0});

  useEffect(()=>{
    const img=new Image();
    img.onload=()=>{
      const maxW=Math.min(img.width,window.innerWidth-32),scale=maxW/img.width,w=maxW,h=img.height*scale;
      setImgSize({w,h});
      const canvas=canvasRef.current;if(!canvas)return;
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
      ctx.strokeStyle="#000";ctx.lineWidth=28;ctx.lineCap="round";ctx.lineJoin="round";
      initialStrokes.forEach(pts=>{if(!pts.length)return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();});
      imgRef.current=img;
    };
    img.src=src;
  },[src,initialStrokes]);

  const redraw=useCallback((all,active)=>{
    const canvas=canvasRef.current;if(!canvas||!imgRef.current)return;
    const ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(imgRef.current,0,0,imgSize.w,imgSize.h);
    ctx.strokeStyle="#000";ctx.lineWidth=28;ctx.lineCap="round";ctx.lineJoin="round";
    const draw=pts=>{if(!pts.length)return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();};
    all.forEach(draw);if(active&&active.length>0)draw(active);
  },[imgSize]);

  const getPos=e=>{const r=canvasRef.current.getBoundingClientRect(),cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;return{x:cx-r.left,y:cy-r.top};};
  const onDown=e=>{e.preventDefault();const p=getPos(e);setDrawing(true);setCurrentStroke([p]);redraw(strokes,[p]);};
  const onMove=e=>{e.preventDefault();if(!drawing)return;const p=getPos(e);setCurrentStroke(prev=>{const ns=[...prev,p];redraw(strokes,ns);return ns;});};
  const onUp=e=>{e.preventDefault();if(!drawing)return;setDrawing(false);if(currentStroke.length>0){const ns=[...strokes,currentStroke];setStrokes(ns);redraw(ns,[]);}setCurrentStroke([]);};
  const undo=()=>{const ns=strokes.slice(0,-1);setStrokes(ns);redraw(ns,[]);};
  const confirm=()=>{const canvas=canvasRef.current;if(!canvas)return;onConfirm(canvas.toDataURL("image/jpeg",0.92).split(",")[1],strokes);};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",display:"flex",flexDirection:"column",alignItems:"center",zIndex:300,overflowY:"auto",padding:"12px 0 0 0"}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:12,padding:16,width:"100%",maxWidth:Math.min(imgSize.w+24,window.innerWidth-8),marginBottom:120}}>
        <div style={{display:"flex",justifyContent:"flex-start",alignItems:"center",marginBottom:10}}>
          <span style={{fontWeight:600,fontSize:15}}>Bereiche schwärzen</span>
        </div>
        <p style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:8}}>Mit dem Finger über Bereiche malen, die geschwärzt werden sollen.</p>
        <canvas ref={canvasRef} style={{display:"block",borderRadius:8,touchAction:"none",cursor:"crosshair",maxWidth:"100%"}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}/>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#1a5276",padding:"20px 32px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",zIndex:301}}>
        <button onClick={onCancel} style={{background:"transparent",border:"none",color:"#7f8c8d",fontSize:15,cursor:"pointer",padding:"8px 12px"}}>Abbrechen</button>
        <button onClick={confirm} style={{width:72,height:72,borderRadius:"50%",border:"4px solid #fff",background:"#27ae60",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:38,color:"#fff",fontWeight:700,lineHeight:1}}>✓</span>
        </button>
        <button onClick={undo} disabled={!strokes.length} style={{background:strokes.length?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.08)",border:"none",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",cursor:strokes.length?"pointer":"not-allowed",fontSize:24,color:strokes.length?"#fff":"#7f8c8d",opacity:strokes.length?1:0.6}}>↩</button>
      </div>
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({x,y,onCamera,onGallery,onClose}){
  useEffect(()=>{const h=()=>onClose();document.addEventListener("click",h,{once:true});return()=>document.removeEventListener("click",h);},[onClose]);
  return(
    <div style={{position:"fixed",left:x,top:y,zIndex:400,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",minWidth:180,overflow:"hidden"}}>
      <button onClick={e=>{e.stopPropagation();onCamera();onClose();}} style={{display:"block",width:"100%",padding:"12px 16px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:14,borderBottom:"0.5px solid var(--color-border-tertiary)"}}>📷 Foto aufnehmen</button>
      <button onClick={e=>{e.stopPropagation();onGallery();onClose();}} style={{display:"block",width:"100%",padding:"12px 16px",border:"none",background:"transparent",textAlign:"left",cursor:"pointer",fontSize:14}}>🖼️ Aus Galerie wählen</button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App(){
  const [view,setView]=useState("home");
  const [players,setPlayers]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [activePlayers,setActivePlayers]=useState([]);
  const [boards,setBoards]=useState([]);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(true);
  const [newPlayerName,setNewPlayerName]=useState("");
  const [capturedImages,setCapturedImages]=useState({});
  const [forcedFouls,setForcedFouls]=useState({});
  const [scanStatus,setScanStatus]=useState("");
  const [isScanning,setIsScanning]=useState(false);
  const [blackoutState,setBlackoutState]=useState(null);
  const [cameraState,setCameraState]=useState(null);
  const [contextMenu,setContextMenu]=useState(null);
  const galleryRefs=useRef({});

  // Disable pull-to-refresh globally
  useEffect(()=>{
    document.body.style.overscrollBehavior="none";
    document.documentElement.style.overscrollBehavior="none";
    return()=>{document.body.style.overscrollBehavior="";document.documentElement.style.overscrollBehavior="";};
  },[]);

  useEffect(()=>{const{players:p,sessions:s}=loadData();setPlayers(p);setSessions(s);setLoading(false);},[]);
  const persist=useCallback((p,s)=>{setPlayers(p);setSessions(s);saveData(p,s);},[]);
  const emptyBoard=()=>({top:["","",""],middle:["","","","",""],bottom:["","","","",""]});
  const addPlayer=()=>{if(!newPlayerName.trim())return;persist([...players,{id:Date.now(),name:newPlayerName.trim(),score:0,games:0}],sessions);setNewPlayerName("");};
  const removePlayer=id=>persist(players.filter(p=>p.id!==id),sessions);

  const startRound=()=>{
    if(activePlayers.length<2)return;
    setBoards(activePlayers.map(()=>emptyBoard()));
    setCapturedImages({});setForcedFouls({});setScanStatus("");setResult(null);
    setView("round");
  };

  const toggleFoul=bi=>{
    setForcedFouls(prev=>{const n={...prev};if(n[bi])delete n[bi];else n[bi]=true;return n;});
    setCapturedImages(prev=>{const n={...prev};delete n[bi];return n;});
  };

  const pressTimer=useRef(null),wasLongPress=useRef(false);
  const handleCameraPress=(e,bi)=>{
    wasLongPress.current=false;
    pressTimer.current=setTimeout(()=>{
      wasLongPress.current=true;
      const rect=e.currentTarget.getBoundingClientRect();
      const menuY=rect.top-120;
      setContextMenu({x:rect.left,y:menuY<10?rect.bottom+4:menuY,boardIndex:bi});
    },500);
  };
  const handleCameraRelease=()=>{if(pressTimer.current){clearTimeout(pressTimer.current);pressTimer.current=null;}};
  const openInAppCamera=bi=>setCameraState({boardIndex:bi});
  const openGallery=bi=>{if(galleryRefs.current[bi])galleryRefs.current[bi].click();};

  const handleCameraCapture=dataUrl=>{
    const bi=cameraState.boardIndex;setCameraState(null);
    setBlackoutState({boardIndex:bi,src:dataUrl,initialStrokes:[],mimeType:"image/jpeg"});
  };
  const handleFileSelected=async(e,bi)=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    e.target.value=null;
    const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    setBlackoutState({boardIndex:bi,src:dataUrl,initialStrokes:[],mimeType:file.type||"image/jpeg"});
  };
  const handleBlackoutConfirm=(b64,strokes,bi,mime,origSrc)=>{
    setCapturedImages(p=>({...p,[bi]:{base64:b64,mimeType:mime,previewUrl:"data:"+mime+";base64,"+b64,originalSrc:origSrc,strokes}}));
    setBlackoutState(null);
    setForcedFouls(p=>{const n={...p};delete n[bi];return n;});
  };
  const removePhoto=bi=>setCapturedImages(p=>{const n={...p};delete n[bi];return n;});

  const allReady=activePlayers.length>0&&activePlayers.every((_,bi)=>capturedImages[bi]||forcedFouls[bi]);

  const handleEvaluate=async()=>{
    if(!allReady)return;
    setIsScanning(true);setScanStatus("KI analysiert Boards…");
    try{
      const imageSlots=activePlayers.map((_,bi)=>forcedFouls[bi]?null:capturedImages[bi]);
      const nonFouledImages=imageSlots.filter(Boolean);
      let recognized=[];
      if(nonFouledImages.length>0)recognized=(await recognizeAllBoards(nonFouledImages))||[];
      let riIdx=0;
      const newBoards=boards.map((b,bi)=>{
        if(forcedFouls[bi])return b;
        const r=recognized[riIdx++];if(!r)return b;
        return{
          top:(Array.isArray(r.top)?r.top:[]).slice(0,3).map(normalizeCard).concat(["",""]).slice(0,3),
          middle:(Array.isArray(r.middle)?r.middle:[]).slice(0,5).map(normalizeCard).concat(["","","","",""]).slice(0,5),
          bottom:(Array.isArray(r.bottom)?r.bottom:[]).slice(0,5).map(normalizeCard).concat(["","","","",""]).slice(0,5),
        };
      });
      setBoards(newBoards);
      const foulsArr=activePlayers.map((_,bi)=>!!forcedFouls[bi]);
      const res=calcPoints(newBoards,foulsArr);
      setResult({...res,fl:newBoards.map((b,i)=>foulsArr[i]?false:qualifiesFL(b))});
      setScanStatus("");
    }catch(err){setScanStatus("Fehler: "+err.message);}
    setIsScanning(false);
  };

  const saveRound=()=>{
    const ns={id:Date.now(),date:new Date().toISOString(),players:activePlayers.map(i=>players[i]?players[i].id:null),playerNames:activePlayers.map(i=>players[i]?players[i].name:""),delta:result.delta,royalties:result.royalties,fouled:result.fouled};
    persist(players.map((p,idx)=>{const pi=activePlayers.indexOf(idx);if(pi===-1)return p;return{...p,score:(p.score||0)+result.delta[pi],games:(p.games||0)+1};}),[ns,...sessions]);
    setResult(null);setView("home");
  };
  const discardRound=()=>setResult(null);

  if(loading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>Lade…</div>;

  const Nav=()=>(
    <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"0.5px solid var(--color-border-tertiary)",paddingBottom:12}}>
      {[["home","ti-home","Home"],["history","ti-history","Verlauf"],["players","ti-users","Spieler"]].map(([v,icon,label])=>(
        <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:view===v?500:400,background:view===v?"var(--color-background-secondary)":"transparent",color:view===v?"var(--color-text-primary)":"var(--color-text-secondary)"}}>
          <i className={"ti "+icon} style={{marginRight:6,fontSize:14,verticalAlign:"-2px"}}/>{label}
        </button>
      ))}
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  if(view==="home")return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"1rem 0",paddingBottom:110,minHeight:"100vh"}}>
      <Nav/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
        <i className="ti ti-cards" style={{fontSize:28,color:"var(--color-text-secondary)"}}/>
        <div>
          <div style={{fontSize:20,fontWeight:500}}>Pineapple OFC</div>
          <div style={{fontSize:13,color:"var(--color-text-secondary)"}}>Spieler für die neue Runde auswählen</div>
        </div>
      </div>
      {players.length===0&&<div style={{padding:"2rem",textAlign:"center",color:"var(--color-text-secondary)",border:"1.5px dashed var(--color-border-tertiary)",borderRadius:12}}>Noch keine Spieler – gehe zu <strong>Spieler</strong> um welche anzulegen.</div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {players.map((p,i)=>{
          const active=activePlayers.includes(i);
          return(
            <div key={p.id} onClick={()=>setActivePlayers(ap=>active?ap.filter(x=>x!==i):activePlayers.length<3?[...ap,i]:ap)}
              style={{padding:"14px 16px",borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",border:active?"2px solid var(--color-border-info)":"0.5px solid var(--color-border-tertiary)",background:active?"var(--color-background-info)":"var(--color-background-primary)",transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:active?"var(--color-background-primary)":"var(--color-background-secondary)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:15,color:active?"var(--color-text-info)":"var(--color-text-secondary)",border:active?"1.5px solid var(--color-border-info)":"none"}}>{p.name.slice(0,2).toUpperCase()}</div>
                <div>
                  <div style={{fontWeight:500,fontSize:15,color:active?"var(--color-text-info)":"var(--color-text-primary)"}}>{p.name}</div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)",marginTop:1}}>{p.games||0} Spiele · {p.score>0?"+":""}{p.score||0} Pts</div>
                </div>
              </div>
              <div style={{width:24,height:24,borderRadius:"50%",border:"2px solid",borderColor:active?"var(--color-border-info)":"var(--color-border-tertiary)",background:active?"var(--color-text-info)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {active&&<span style={{color:"var(--color-background-primary)",fontSize:14,lineHeight:1}}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 16px",background:"var(--color-background-primary)",borderTop:"0.5px solid var(--color-border-tertiary)",zIndex:50}}>
        <div style={{maxWidth:680,margin:"0 auto"}}>
          {activePlayers.length>=2&&(
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
              {activePlayers.map(i=><span key={i} style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:"var(--color-background-info)",color:"var(--color-text-info)",fontWeight:500}}>{players[i]?players[i].name:""}</span>)}
            </div>
          )}
          <button onClick={startRound} disabled={activePlayers.length<2}
            style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",fontWeight:600,fontSize:16,cursor:activePlayers.length>=2?"pointer":"not-allowed",background:activePlayers.length>=2?"var(--color-background-info)":"var(--color-background-secondary)",color:activePlayers.length>=2?"var(--color-text-info)":"var(--color-text-tertiary)"}}>
            {activePlayers.length>=2?"Runde starten ("+activePlayers.length+" Spieler)":"Mindestens 2 Spieler wählen"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── ROUND ─────────────────────────────────────────────────────────────────
  if(view==="round"){
    const BOTTOM_H=result?130:100;
    return(
      <div style={{maxWidth:680,margin:"0 auto",paddingBottom:BOTTOM_H+16,minHeight:"100vh"}}>
        {cameraState&&<InAppCamera onCapture={handleCameraCapture} onCancel={()=>setCameraState(null)}/>}
        {blackoutState&&<ImageBlackoutEditor src={blackoutState.src} initialStrokes={blackoutState.initialStrokes||[]}
          onConfirm={(b64,strokes)=>handleBlackoutConfirm(b64,strokes,blackoutState.boardIndex,blackoutState.mimeType,blackoutState.src)}
          onCancel={()=>setBlackoutState(null)}/>}
        {contextMenu&&<ContextMenu x={contextMenu.x} y={contextMenu.y}
          onCamera={()=>openInAppCamera(contextMenu.boardIndex)} onGallery={()=>openGallery(contextMenu.boardIndex)} onClose={()=>setContextMenu(null)}/>}
        {activePlayers.map((_,bi)=>(<input key={bi} ref={el=>galleryRefs.current[bi]=el} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFileSelected(e,bi)}/>))}

        <div style={{padding:"1rem 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <button onClick={()=>setView("home")} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--color-text-secondary)",fontSize:20}}><i className="ti ti-arrow-left"/></button>
            <span style={{fontWeight:500,fontSize:16}}>Karten eingeben</span>
          </div>
          {scanStatus&&<div style={{padding:"8px 14px",borderRadius:8,background:"var(--color-background-secondary)",fontSize:13,color:"var(--color-text-secondary)",marginBottom:10}}>{scanStatus}</div>}
          {activePlayers.map((pi,bi)=>{
            const p=players[pi];
            const fouled=boards[bi]?isFouled(boards[bi]):false;
            const royalty=boards[bi]&&!fouled?getTotalRoyalties(boards[bi]):0;
            const fl=boards[bi]&&!fouled?qualifiesFL(boards[bi]):false;
            return<BoardEditor key={pi} board={boards[bi]||emptyBoard()} onChange={nb=>setBoards(bs=>bs.map((b,i)=>i===bi?nb:b))} label={(p&&p.name)||"Spieler "+(bi+1)} fouled={fouled} royalty={royalty} fl={fl} isForcedFoul={!!forcedFouls[bi]}/>;
          })}
        </div>

        {/* ── Pinned Bottom Bar ── */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#1a5276",borderTop:"2px solid #154360",zIndex:50,boxShadow:"0 -4px 20px rgba(0,0,0,0.3)"}}>
          <div style={{maxWidth:680,margin:"0 auto",padding:"10px 12px"}}>
            {result?(
              <>
                <div style={{display:"flex",gap:8,marginBottom:10,justifyContent:"center",flexWrap:"wrap"}}>
                  {activePlayers.map((pi,i)=>{
                    const p=players[pi],d=result.delta[i];
                    return(
                      <div key={pi} style={{textAlign:"center",background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"8px 14px",minWidth:80}}>
                        <div style={{fontSize:12,color:"rgba(255,255,255,0.8)",marginBottom:2}}>{p?p.name:""}</div>
                        <div style={{fontSize:22,fontWeight:600,color:d>0?"#2ecc71":d<0?"#e74c3c":"#bdc3c7"}}>{d>0?"+":""}{d}</div>
                        {result.fouled[i]&&<div style={{fontSize:10,color:"#e74c3c",marginTop:1}}>Fouled</div>}
                        {result.fl&&result.fl[i]&&<div style={{fontSize:10,color:"#f1c40f",marginTop:1}}>Fantasyland!</div>}
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={discardRound} style={{flex:1,padding:"12px 0",borderRadius:10,border:"1.5px solid rgba(255,255,255,0.3)",background:"transparent",color:"#fff",fontWeight:500,fontSize:14,cursor:"pointer"}}>Verwerfen</button>
                  <button onClick={saveRound} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"#2ecc71",color:"#fff",fontWeight:600,fontSize:15,cursor:"pointer"}}>✓ Speichern</button>
                </div>
              </>
            ):(
              <>
                <div style={{display:"flex",gap:8,marginBottom:10,justifyContent:"space-around"}}>
                  {activePlayers.map((pi,bi)=>{
                    const p=players[pi],img=capturedImages[bi],foul=!!forcedFouls[bi],hasContent=img||foul;
                    return(
                      <div key={bi} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5,minWidth:0}}>
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.8)",fontWeight:500,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{p?p.name:"P"+(bi+1)}</span>
                        {/* Photo preview — only shown when image captured */}
                        {img&&(
                          <div style={{position:"relative",width:"100%",maxWidth:72,aspectRatio:"1/1"}}>
                            <img src={img.previewUrl} alt="" onClick={()=>setBlackoutState({boardIndex:bi,src:img.originalSrc,mimeType:img.mimeType,initialStrokes:img.strokes||[]})}
                              style={{width:"100%",height:"100%",objectFit:"contain",borderRadius:6,display:"block",cursor:"pointer",border:"1.5px solid rgba(255,255,255,0.3)",backgroundColor:"#000"}}/>
                            <button onClick={()=>removePhoto(bi)} style={{position:"absolute",top:-6,right:-6,background:"#e74c3c",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:0}}>✕</button>
                          </div>
                        )}
                        {/* Foul indicator — only shown when foul toggled */}
                        {foul&&!img&&(
                          <div style={{width:"100%",maxWidth:72,padding:"6px 0",textAlign:"center",background:"rgba(231,76,60,0.2)",border:"1.5px solid #e74c3c",borderRadius:6}}>
                            <span style={{fontSize:11,color:"#e74c3c",fontWeight:600}}>✕ Foul</span>
                          </div>
                        )}
                        {/* Camera + Foul buttons: hidden when content exists */}
                        {!hasContent&&(
                          <>
                            <button
                              onMouseDown={e=>handleCameraPress(e,bi)} onMouseUp={()=>handleCameraRelease()}
                              onMouseLeave={()=>handleCameraRelease()} onTouchStart={e=>handleCameraPress(e,bi)} onTouchEnd={()=>handleCameraRelease()}
                              onClick={()=>{if(!wasLongPress.current)openInAppCamera(bi);wasLongPress.current=false;}}
                              style={{width:"100%",padding:"8px 0",borderRadius:8,border:"1.5px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.12)",color:"#fff",cursor:"pointer",fontSize:20,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
                              📷
                            </button>
                            <button onClick={()=>toggleFoul(bi)}
                              style={{width:"100%",padding:"7px 0",borderRadius:8,border:"none",background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)",fontWeight:400,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                              Foul
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleEvaluate} disabled={!allReady||isScanning}
                  style={{width:"100%",padding:"13px 0",borderRadius:10,border:"none",fontWeight:600,fontSize:15,cursor:allReady&&!isScanning?"pointer":"not-allowed",background:allReady&&!isScanning?"#f39c12":"rgba(255,255,255,0.15)",color:allReady&&!isScanning?"#fff":"rgba(255,255,255,0.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  <i className="ti ti-sparkles" style={{fontSize:16}}/>{isScanning?"Analysiere…":"Auswertung"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── HISTORY ───────────────────────────────────────────────────────────────
  if(view==="history")return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"1rem 0"}}>
      <Nav/>
      <h3 style={{fontWeight:500,fontSize:16,marginBottom:16}}>Spielverlauf</h3>
      {sessions.length===0&&<div style={{padding:"2rem",textAlign:"center",color:"var(--color-text-secondary)",border:"1.5px dashed var(--color-border-tertiary)",borderRadius:12}}>Noch keine Runden gespeichert.</div>}
      {sessions.map(s=>(
        <div key={s.id} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:12,padding:"1rem 1.25rem",marginBottom:10,background:"var(--color-background-primary)"}}>
          <div style={{fontSize:13,color:"var(--color-text-secondary)",marginBottom:8}}>{new Date(s.date).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {s.playerNames.map((name,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{name}</span>
                <span style={{fontWeight:500,color:s.delta[i]>0?"var(--color-text-success)":s.delta[i]<0?"var(--color-text-danger)":"var(--color-text-secondary)"}}>{s.delta[i]>0?"+":""}{s.delta[i]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  // ── PLAYERS ───────────────────────────────────────────────────────────────
  if(view==="players")return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"1rem 0"}}>
      <Nav/>
      <h3 style={{fontWeight:500,fontSize:16,marginBottom:16}}>Spielerverwaltung</h3>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <input value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} placeholder="Neuer Spieler..."
          style={{flex:1,padding:"8px 12px",borderRadius:8,border:"0.5px solid var(--color-border-secondary)"}}/>
        <button onClick={addPlayer} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"var(--color-background-info)",color:"var(--color-text-info)",fontWeight:500,cursor:"pointer"}}>
          <i className="ti ti-plus"/> Hinzufügen
        </button>
      </div>
      {players.map(p=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",border:"0.5px solid var(--color-border-tertiary)",borderRadius:10,padding:"12px 16px",marginBottom:8,background:"var(--color-background-primary)"}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:"var(--color-background-secondary)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:500,fontSize:14,marginRight:12}}>{p.name.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:500}}>{p.name}</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>{p.games||0} Spiele · Gesamt: {p.score>0?"+":""}{p.score||0}</div>
          </div>
          <button onClick={()=>removePlayer(p.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:18}}><i className="ti ti-trash"/></button>
        </div>
      ))}
    </div>
  );
}