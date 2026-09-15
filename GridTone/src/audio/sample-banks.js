/** Small, explicit CC0 sample selections, mapped from upstream SFZ pitch_keycenter values.
 * Source commit is pinned. Downloads happen only after a user action. No project is uploaded.
 * This is a lightweight single-velocity instrument, not a complete SFZ player.
 */
(function(G){'use strict';
 const commit='6dd651d55dde97fd4028699be9d4481f26917891',base=`https://raw.githubusercontent.com/sgossner/VSCO-2-CE/${commit}/`;
 const banks=[
  {id:'vsco.piano',name:'实录立式钢琴',category:'键盘',description:'真实琴弦与琴槌，保留室内录音的质地。中力度、多音高轻量版。',sfz:'UprightPiano.sfz',folder:'Keys/Upright Piano/',release:.6,files:[[49,'Player_dyn2_rr1_014.wav'],[57,'Player_dyn2_rr1_018.wav'],[65,'Player_dyn2_rr1_022.wav'],[73,'Player_dyn2_rr1_026.wav'],[81,'Player_dyn2_rr1_030.wav']]},
  {id:'vsco.harp',name:'实录竖琴',category:'拨弦',description:'拨弦起音与自然琴体共振，适合稀疏分解和弦。',sfz:'Harp.sfz',folder:'Strings/Harp/',release:1.5,files:[[48,'KSHarp_C3_mf.wav'],[59,'KSHarp_B3_mf.wav'],[69,'KSHarp_A4_mf.wav'],[79,'KSHarp_G5_mf.wav']]},
  {id:'vsco.marimba',name:'实录马林巴',category:'钟琴 / 敲击',description:'木槌的起音和共鸣管尾音，适合轻快的短旋律。',sfz:'Marimba.sfz',folder:'Percussion/Marimba/',release:1.1,files:[[48,'Marimba_hit_Outrigger_C2_loud_01.wav'],[59,'Marimba_hit_Outrigger_B2_loud_01.wav'],[72,'Marimba_hit_Outrigger_C4_loud_01.wav'],[83,'Marimba_hit_Outrigger_B4_loud_01.wav']]},
  {id:'vsco.flute',name:'实录长笛',category:'管乐',description:'直音长笛录音，保留气流和自然起音。建议 C4–A5。',sfz:'FluteSusNV.sfz',folder:'Woodwinds/Flute/susNV/',release:.5,files:[[60,'LDFlute_susNV_C3_v1_1.wav'],[69,'LDFlute_susNV_A3_v1_1.wav'],[81,'LDFlute_susNV_A4_v1_1.wav']]},
  {id:'vsco.violinpizz',name:'实录小提琴拨奏',category:'拨弦',description:'短促的琴弦拨奏，保留琴体共鸣与手指触弦声，适合轻巧伴奏。',sfz:'SViolinPizz.sfz',folder:'Strings/Solo Violin/Pizz/',release:.5,files:[[60,'LLVln_Pizz_C4_p_RR1.wav'],[64,'LLVln_Pizz_E4_p_RR1.wav'],[72,'LLVln_Pizz_C5_p_RR1.wav'],[76,'LLVln_Pizz_E5_p_RR1.wav']]},
  {id:'vsco.glock',name:'实录钟琴',category:'钟琴 / 敲击',description:'真实金属琴片的明亮共振，建议用于高音点缀。',sfz:'Glockenspiel.sfz',folder:'Percussion/Glock/',release:1.5,files:[[67,'glock_medium_G4.wav'],[72,'glock_medium_C5.wav'],[79,'glock_medium_G5.wav'],[84,'glock_medium_C6.wav']]}
 ].map(b=>({...b,license:'CC0-1.0',author:'Sam Gossner / Simon Dalzell; sample cutting Elan Hickler',source:'https://versilian-studios.com/vsco-community/',commit,zones:b.files.map(([root,file])=>({root,url:base+[b.folder,file].join('').split('/').map(encodeURIComponent).join('/'),sourcePath:b.folder+file}))}));
 function abortError(){return new DOMException('载入已取消。','AbortError');}
 async function fetchBytes(url,signal,max=12*1024*1024){
  const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='raw.githubusercontent.com'||!u.pathname.startsWith('/sgossner/VSCO-2-CE/'))throw Error('音源下载地址不在已核对的来源中。');
  const r=await fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('音源服务器返回 HTTP '+r.status);
  const size=Number(r.headers.get('content-length')||0);if(size>max)throw Error('单个采样超过 12 MB。');
  const reader=r.body?.getReader();if(!reader){const b=await r.arrayBuffer();if(b.byteLength>max)throw Error('采样过大。');return b;}
  const chunks=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw Error('采样超过下载上限。');}chunks.push(value);}
  const out=new Uint8Array(total);let at=0;chunks.forEach(c=>{out.set(c,at);at+=c.length;});return out.buffer;
 }
 async function lightWav(buffer,normalization=1){
  // Fixed 24 kHz mono lightweight representation. Safe fade; no synthetic looping.
  const rate=24000,length=Math.max(1,Math.floor(Math.min(buffer.duration,6)*rate)),C=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  const ctx=new C(1,length,rate),s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;s.connect(g);g.connect(ctx.destination);g.gain.value=normalization;
  g.gain.setValueAtTime(normalization,Math.max(0,length/rate-.03));g.gain.linearRampToValueAtTime(0,length/rate);s.start(0);const out=await ctx.startRendering();return G.blobDataURL(new Blob([G.encodeWav(out,1)],{type:'audio/wav'}));
 }
 async function downloadBank(id,{signal,onProgress=()=>{},fetcher=fetchBytes}={}){
  const bank=banks.find(b=>b.id===id);if(!bank)throw Error('找不到这个音源。');
  const C=globalThis.AudioContext||globalThis.webkitAudioContext,ctx=new C(),buffers=[];
  try{
   for(let i=0;i<bank.zones.length;i++){
    if(signal?.aborted)throw abortError();onProgress({done:i,total:bank.zones.length,name:bank.name});
    const raw=await fetcher(bank.zones[i].url,signal);if(signal?.aborted)throw abortError();
    const decoded=await ctx.decodeAudioData(raw);if(!Number.isFinite(decoded.duration)||decoded.duration<.02||decoded.duration>90)throw Error('采样长度异常。');buffers.push(decoded);
   }
   // One gain for the entire instrument preserves relative sample dynamics.
   let peak=0;for(const b of buffers)for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));}
   if(!Number.isFinite(peak)||peak<.00001)throw Error('采样没有可用声音。');
   const gain=Math.min(8,.86/peak),assets={},zones=[];
   for(let i=0;i<buffers.length;i++){if(signal?.aborted)throw abortError();const root=bank.zones[i].root,assetId=bank.id+'.n'+root;assets[assetId]={name:bank.name+' '+G.noteName(root),root,mode:'pitched',data:await lightWav(buffers[i],gain)};zones.push({root,assetId,gain:1});}
   if(signal?.aborted)throw abortError();
   const pack={format:'gridtone.catalog',version:1,id:bank.id+'.light.v1',name:bank.name+' · VSCO CC0',presets:[{id:bank.id,version:1,name:bank.name,category:bank.category,description:bank.description,engine:'multisample',wave:'sine',ratio:1,index:0,release:bank.release,decay:0,zones,gain:.8,tags:['真实采样','CC0','轻量版'],origin:bank.author+' / VSCO 2 CE / CC0-1.0'}],drumkits:[],templates:[],assets};
   G.validateCatalog(pack);onProgress({done:bank.zones.length,total:bank.zones.length,name:bank.name});return pack;
  } finally { await ctx.close().catch(()=>{}); }
 }
 Object.assign(G,{SAMPLE_BANKS:banks,downloadSampleBank:downloadBank,fetchSampleBytes:fetchBytes});
})(globalThis.GridTone ||= {});
