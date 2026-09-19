/** Original curated content, plus explicitly licensed small sound sources.
 * This generator is the editable source of expansion.library.v1. No network at build time. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const pack={format:'gridtone.catalog',version:1,id:'expansion.library.v1',name:'乐构 · 经典电路与律动',presets:[],drumkits:[],templates:[],assets:{}},families=[],sources={};
const base=await read('catalog/studio.json'),receipts=await read('vendor/expansion/sources.json');
const copy=x=>structuredClone(x),N=(pitch,start,duration,velocity=.7)=>({pitch,start:Math.round(start*240),duration:Math.max(1,Math.round(duration*240)),velocity});
function family(id,name,role,subcategory,members,description,kind='rhythm'){
 families.push({id:'family.expansion.'+id,name,role,subcategory,members,defaultId:members[0],description,kind,tags:[subcategory]});
}
function preset(id,name,category,subcategory,description,synthesis,gain=.85){
 const p={id:'expansion.'+id,version:1,name,category,description,engine:synthesis.type,wave:'sine',ratio:1,index:1,release:synthesis.release,decay:.3,gain,tags:[subcategory],origin:'乐构原创合成预设 · 非商业设备原厂音色',synthesis};
 pack.presets.push(p);family(id,name,category==='低音'?'bass':category==='铺底'?'texture':category==='键盘'?'chords':'melody',subcategory,[p.id],description,'sound');return p;
}
const va=base.presets.find(p=>p.engine==='studio-va').synthesis;
// Each row changes oscillator structure, envelope, register, filter articulation and/or modulation.
const analog=[
 ['mini-bass','厚实低音 · Mini 风格','低音','受经典 Minimoog 低音启发：锯齿、方波与正弦低层，较短滤波包络；原创近似。',{wave1:'sawtooth',wave2:'square',mix:.35,detune:2,sub:.55,cutoff:.37,resonance:.25,envAmount:2.2,filterDecay:.21,decay:.35,sustain:.5,mono:true,glide:.018,release:.13}],
 ['mini-lead','歌唱滑音 · Mini 风格','主音','受经典单音模拟主音启发：近同度双波、持续滤波和明显滑音；原创近似。',{wave1:'triangle',wave2:'sawtooth',mix:.3,detune:5,sub:.15,cutoff:.56,resonance:.2,envAmount:.8,attack:.025,decay:.4,sustain:.9,mono:true,glide:.12,vibrato:7,lfoRate:5,release:.27}],
 ['reese','失谐双锯低音','低音','宽而缓慢拍动的双锯齿低音。',{wave1:'sawtooth',wave2:'sawtooth',mix:.5,detune:22,sub:.25,cutoff:.42,resonance:.05,envAmount:0,sustain:.9,attack:.025,release:.12}],
 ['acid','酸性滑音','低音','单音、共振扫频与短滑音；相邻音符衔接时最明显。',{wave1:'sawtooth',wave2:'square',mix:.12,detune:0,sub:0,cutoff:.3,resonance:.85,envAmount:4.2,filterDecay:.18,decay:.2,sustain:.18,mono:true,glide:.075,release:.08}],
 ['rubber','橡皮八度','低音','方波上八度与快速滤波回落，短促而有弹性。',{wave1:'square',wave2:'square',mix:.28,octave2:1,sub:.2,cutoff:.33,resonance:.48,envAmount:3.6,filterDecay:.11,decay:.12,sustain:.1,release:.09}],
 ['brass','黄铜合成器','键盘','双锯齿缓起音，滤波先张开再收回，适合和弦重拍。',{wave1:'sawtooth',wave2:'sawtooth',mix:.5,detune:8,sub:0,attack:.09,decay:.35,sustain:.7,cutoff:.43,envAmount:2.8,filterDecay:.6,chorus:.25,release:.22}],
 ['strings','磁带弦幕','铺底','慢起音双锯齿、合唱和轻颤音，适合持续和弦。',{wave1:'sawtooth',wave2:'sawtooth',mix:.5,detune:12,sub:0,attack:.6,decay:1.5,sustain:.8,cutoff:.59,envAmount:0,chorus:.7,vibrato:4,lfoRate:4.8,release:1.6}],
 ['pulse-key','空心脉冲键','键盘','方波与下八度三角波，快速衰减的空心和弦音。',{wave1:'square',wave2:'triangle',mix:.28,octave2:-1,sub:0,attack:.003,decay:.22,sustain:.06,cutoff:.62,envAmount:1.2,filterDecay:.12,chorus:.15,release:.15}],
 ['sync-lead','八度锐光','主音','锯齿上八度叠层与轻颤音，适合突出旋律。',{wave1:'sawtooth',wave2:'square',mix:.4,octave2:1,detune:3,sub:0,cutoff:.65,envAmount:1.5,attack:.014,sustain:.7,vibrato:9,lfoRate:5.2,mono:true,glide:.04,release:.2}],
 ['slow-motion','缓流滤波','铺底','三角波与锯齿叠层，缓慢滤波往返，适合稀疏氛围。',{wave1:'triangle',wave2:'sawtooth',mix:.4,sub:0,detune:15,attack:1.1,decay:2,sustain:.75,cutoff:.51,envAmount:0,motion:.8,lfoRate:.13,chorus:.65,release:2}]
];
for(const [id,name,category,description,params]of analog){
 const classic={acid:['酸性低音 · 303 风格','TB-303 酸性滤波的风格近似'],strings:['合唱弦幕 · Juno 风格','Juno 合唱弦乐的风格近似'],brass:['复古合成铜管','经典复音模拟铜管的风格近似']}[id];
 preset('va.'+id,classic?.[0]||name,category,'模拟电路',description+(classic?' '+classic[1]+'，原创预设。':''),{...copy(va),...params},category==='铺底'?.75:.82);
}
const fm=base.presets.find(p=>p.engine==='studio-fm4').synthesis;
const digital=[
 ['velvet','绒面数字电钢','键盘','两对调制器带来柔和主体和短暂金属起音。',1,[1,1,2,9],[1,1.1,.32,.8],.004,1.1,.12,.8],
 ['tubular','管状钟','主音','非整数倍频与较长衰减，带悬浮的金属余韵。',2,[1,2.76,5.43,8.21],[1,1.7,.8,.4],.003,2.5,.02,1.7],
 ['slap','弹指数字低音','低音','短暂高调制深度迅速收束到低频主体。',0,[1,1,2,3],[1,4,2,.6],.002,.2,.16,.12],
 ['marble','玻璃珠拨弦','主音','高比率短衰减调制，颗粒清楚，适合分解和弦。',3,[1,3,7,11],[1,1.5,.8,.4],.002,.28,.02,.32],
 ['reed','数字簧片','键盘','奇数倍频主体与持续调制，适合连奏和短促和弦。',1,[1,2,3,4],[.85,1.7,.25,1.1],.035,.5,.62,.24],
 ['ice','冰晶键','键盘','两组不同比率叠出清透的高频轮廓。',1,[1,5,2,3.5],[.9,2.4,.2,1.3],.003,.85,.07,.65],
 ['halo','金属光环','铺底','慢包络和持续非整数调制形成缓慢展开的金属铺底。',2,[1,1.5,2.01,3.51],[.8,.55,.36,.3],.7,2,.65,1.8],
 ['woodblock','数字木块','主音','高比率、极短调制与快速归零，适合旋律性打击乐。',0,[1,3.5,7,2],[1,3,1,.25],.002,.09,.01,.06]
];
for(const [id,name,category,description,algorithm,ratios,levels,attack,decay,sustain,release]of digital){
 const synthesis={...copy(fm),algorithm,attack,decay,sustain,release,chorus:category==='铺底'?.5:category==='低音'?0:.18,operators:ratios.map((ratio,i)=>({ratio,level:levels[i],decay:i?Math.max(.015,decay*(i===1?.28:.1)):decay,sustain:i?Math.max(.01,sustain*.6):Math.max(.01,sustain),detune:0}))};
 preset('fm.'+id,id==='velvet'?'数字电钢 · DX 风格':name,category,'FM 数字',description+(id==='velvet'?' 受 DX 系列电钢启发，采用四运算器原创实现。':''),synthesis,category==='铺底'?.7:.82);
}
function wavCycle(buf){
 let pcm,channels,bits,format;for(let at=12;at+8<=buf.length;){const tag=buf.toString('ascii',at,at+4),n=buf.readUInt32LE(at+4);if(at+8+n>buf.length)throw Error('Invalid WAV');if(tag==='fmt '){format=buf.readUInt16LE(at+8);channels=buf.readUInt16LE(at+10);bits=buf.readUInt16LE(at+22);}if(tag==='data')pcm=buf.subarray(at+8,at+8+n);at+=8+n+(n%2);}
 if(format!==1||channels!==1||bits!==16||!pcm)throw Error('Expected mono PCM16');return Array.from({length:pcm.length/2},(_,i)=>pcm.readInt16LE(i*2)/32768);
}
const waves=[['bw_blended','柔光混合','铺底',.35,.65],['distorted','折叠锋芒','低音',.005,.12],['eguitar','电流拨弦','主音',.003,.035],['eorgan','复古电子风琴','键盘',.01,.85],['hvoice','数字人声云','铺底',.65,.8],['oboe','空心合成簧','主音',.05,.6],['sinharm','泛音水滴','键盘',.003,.04],['vgame','像素脉冲','主音',.002,.45]];
for(const [slug,name,category,attack,sustain]of waves){
 const receipt=receipts.find(r=>r.source==='akwf'&&r.path.includes('/AKWF_'+slug+'/')),buf=await readFile(new URL('vendor/expansion/akwf/'+receipt.path,root));
 if(createHash('sha256').update(buf).digest('hex')!==receipt.sha256)throw Error('Source hash mismatch');
 const cycle=wavCycle(buf),real=[0],imag=[0];
 // 64 Fourier partials; browser PeriodicWave handles pitch-dependent band limiting.
 for(let k=1;k<=64;k++){let re=0,im=0;for(let i=0;i<cycle.length;i++){re+=cycle[i]*Math.cos(2*Math.PI*k*i/cycle.length);im+=cycle[i]*Math.sin(2*Math.PI*k*i/cycle.length);}real.push(+((2*re)/cycle.length).toFixed(7));imag.push(+((2*im)/cycle.length).toFixed(7));}
 const description='AKWF 单周期谱形 · '+({bw_blended:'缓起音混合泛音，适合透明铺底。',distorted:'折叠状谐波轮廓，适合紧凑低音。',eguitar:'电流感短拨弦，清楚的硬质起音。',eorgan:'持续电子风琴轮廓，可连奏叠和弦。',hvoice:'带元音质感的合成铺底，不含人声录音短句。',oboe:'带鼻音的空心簧片质感，适合旋律。',sinharm:'正弦泛音组合与短衰减，适合水滴式分解。',vgame:'早期电子游戏风格，清楚直接。'})[slug];
 const p=preset('wave.'+slug,name,category,'单周期波形',description,{version:1,type:'studio-wave',real,imag,attack,decay:category==='铺底'?1.6:.35,sustain,release:category==='铺底'?1.2:.2,cutoff:category==='低音'?2400:8500},.8);
 p.origin=`AKWF · Kristoffer Karl Axel Ekstrand · CC0-1.0 · ${receipt.path.split('/').at(-1)}；乐构原创包络与滤波`;
}
const drums=[['bd8/BD5050.WAV',36,'底鼓','kick'],['sd8/SD5050.WAV',38,'军鼓','snare'],['ch8/CH.WAV',42,'闭镲','closedHat'],['oh8/OH50.WAV',46,'开镲','openHat'],['cp8/CP.WAV',39,'拍手','clap'],['lt8/LT50.WAV',45,'低通鼓','tom'],['cy8/CY5050.WAV',49,'镲','crash'],['rs8/RS.WAV',37,'边击','rim'],['cb8/CB.WAV',56,'牛铃'],['cl8/CL.WAV',75,'响棒'],['hc8/HC50.WAV',63,'高康加'],['ht8/HT50.WAV',50,'高通鼓'],['lc8/LC50.WAV',64,'低康加'],['ma8/MA.WAV',70,'沙锤'],['mc8/MC50.WAV',62,'中康加'],['mt8/MT50.WAV',47,'中通鼓']];
const kit={id:'expansion.kit.808',version:1,name:'808 · Fischer 原声',rows:[]};
for(const [path,pitch,name,role]of drums){const bytes=await readFile(new URL('vendor/expansion/tr808/'+path,root)),receipt=receipts.find(r=>r.source==='tr808'&&r.path===path);if(createHash('sha256').update(bytes).digest('hex')!==receipt.sha256)throw Error('Source hash mismatch');const id='expansion.808.'+pitch;pack.assets[id]={name:'808 '+name,data:'data:audio/wav;base64,'+bytes.toString('base64'),root:pitch,mode:'oneshot'};kit.rows.push({pitch,name,en:name,...(role?{role}:{}),velocity:1,source:{type:'sample',assetId:id}});}
pack.drumkits.push(kit);pack.presets.push({id:'expansion.drum.808',drumkitId:kit.id,version:1,name:'808 · 经典鼓机',category:'鼓组',description:'16 件 TR-808 实机短采样：低鼓、军鼓、镲、拍手、牛铃与拉丁打击乐。',engine:'drum',wave:'sine',ratio:1,index:1,release:.32,decay:.3,origin:'Michael Fischer · 1994 TR-808 recordings · CC0-1.0',tags:['经典鼓机','808']});family('808','808 · 经典鼓机','drums','经典鼓机',['expansion.drum.808'],'16 件实机录音，小体积离线内置。','sound');
function template(id,name,role,subcategory,description,notes,{bars=2,presetId,drumkitId,scale='major'}={}){
 const t={id:'expansion.pattern.'+id,version:1,type:'pattern',name,role,description,kind:role==='drums'?'drum':'melodic',bars,key:0,scale,presetId:presetId||(role==='drums'?'expansion.drum.808':role==='bass'?'expansion.va.rubber':'expansion.fm.velvet'),...(role==='drums'?{drumkitId:drumkitId||kit.id}:{}),notes:notes.sort((a,b)=>a.start-b.start||a.pitch-b.pitch),tags:[subcategory,'4/4'],license:'MIT',origin:'乐构原创编排 · 传统风格的节奏语汇，不引用歌曲旋律'};
 pack.templates.push(t);family(id,name,role,subcategory,[t.id],description);sources[t.id]={license:'MIT',credit:'GridTone contributors',source:t.origin};return t;
}
// Explicit two-bar skeletons: 32 sixteenth-note positions. Accents, rests, backbeats
// and subdivisions differ. Genre names describe inspiration, not canonical transcriptions.
const grooves=[
 ['disco','迪斯科开镲','四拍舞曲','四拍底鼓、反拍开镲和第二小节切分低鼓；建议 112–124 BPM。',[[36,[0,4,8,12,16,20,24,28,30]],[38,[4,12,20,28]],[46,[2,6,10,14,18,22,26,30]],[42,[0,8,16,24]]]],
 ['electro','电气切拍','碎拍','不连续底鼓、机械边击和八分镲；建议 112–128 BPM。',[[36,[0,7,10,16,19,26]],[38,[4,12,20,28]],[42,[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]],[37,[3,11,18,27]]]],
 ['two-step','车库两步','碎拍','错开的低鼓与空拍，镲在反拍形成推动；建议 128–136 BPM。',[[36,[0,6,18,24]],[38,[4,12,20,28]],[42,[0,3,6,8,11,14,16,19,22,24,27,30]],[46,[10,26]]]],
 ['dnb','高速碎拍','碎拍','高速度下的错位底鼓、稳定军鼓与幽灵音；建议 160–174 BPM。',[[36,[0,10,16,22]],[38,[4,12,20,28]],[42,[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]],[37,[7,15,23,31]]]],
 ['trap','半拍陷阱','嘻哈与半拍','第三拍军鼓、稀疏底鼓和结尾双倍镲；建议 130–150 BPM。',[[36,[0,7,14,16,23,26]],[38,[8,24]],[42,[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,28.5,29,29.5,30,30.5,31,31.5]]]],
 ['boom-bap','回弹 Boom-bap','嘻哈与半拍','略靠后的军鼓与长短交替镲，保留低鼓空隙；建议 84–96 BPM。',[[36,[0,6,10,16,21,26,30]],[38,[4.15,12.15,20.15,28.15]],[42,[0,2.65,4,6.65,8,10.65,12,14.65,16,18.65,20,22.65,24,26.65,28,30.65]]]],
 ['one-drop','雷鬼 One-drop','雷鬼与拉丁','第一拍留空，第三拍底鼓与边击同落，反拍闭镲；建议 70–90 BPM。',[[36,[8,24]],[37,[8,24]],[42,[2,6,10,14,18,22,26,30]],[46,[15,31]]]],
 ['dembow','Dembow 律动','雷鬼与拉丁','底鼓与交错拍手构成循环重心；建议 90–106 BPM。',[[36,[0,8,16,24]],[39,[3,6,11,14,19,22,27,30]],[42,[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]]]],
 ['bossa','波萨轻步','雷鬼与拉丁','轻底鼓、跨两小节边击切分与沙锤；建议 120–144 BPM。',[[36,[0,6,8,14,16,22,24,30]],[37,[0,6,12,20,26]],[70,[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]]]],
 ['afro','三三二交织','雷鬼与拉丁','3+3+2 重音与牛铃交错的双小节练习；建议 96–112 BPM。',[[36,[0,6,12,16,22,28]],[39,[8,24]],[56,[0,6,12,18,24,28]],[70,[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30]],[63,[5,13,21,29]]]],
 ['funk','十六分口袋','放克与灵魂','底鼓切分、轻军鼓装饰与开闭镲交替；建议 98–112 BPM。',[[36,[0,3,7,10,16,19,23,30]],[38,[4,12,20,28]],[37,[6,9,15,22,25,31]],[42,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29]],[46,[30]]]],
 ['tom-fill','滚奏过门','过门与收尾','从稳拍进入通鼓下行，最后留空准备下一段；建议 100–128 BPM。',[[36,[0,8,16,24]],[38,[4,12,18,19]],[42,[0,2,4,6,8,10,12,14]],[50,[20,21]],[47,[22,23]],[45,[24,26,28]],[49,[16]]]]
];
for(const [id,name,sub,desc,rows]of grooves){const notes=rows.flatMap(([pitch,steps])=>steps.map((step,i)=>({...N(pitch,step,.4,[42,70].includes(pitch)?(i%2?.38:.58):pitch===37?.42:step%8===0?.84:.7),...(id==='boom-bap'?{performed:true}:{})})));template('drum.'+id,name,'drums',sub,desc,notes);}
// Accompaniment is a C reference shape; transposition follows the existing explicit placement plan.
const parts=[
 ['offbeat','反拍短和弦','texture','反拍与切分',[[2,.9],[6,.9],[10,.9],[14,.9]],'反拍短和弦，适合雷鬼或四拍舞曲。'],
 ['charleston','Charleston 切分','texture','反拍与切分',[[0,1.4],[6,2]],'第一拍与第二拍后半组成疏朗的双击。'],
 ['clave-comp','双小节切分伴奏','texture','反拍与切分',[[0,1.5],[6,1.5],[12,1.5],[20,1.5],[26,1.5]],'跨两小节的长短间隔，与轻打击乐呼应。'],
 ['pulses','八分推进','texture','脉冲与持续',Array.from({length:8},(_,i)=>[i*2,1.2]),'短八分和弦推动，适合逐渐增加层次。'],
 ['long','呼吸长和弦','texture','脉冲与持续',[[0,27]],'一个长和弦后留出五个十六分音符的呼吸空间。'],
 ['arp-up','跨八度上行','texture','分解和弦',[[0,1.5],[2,1.5],[4,1.5],[6,1.5],[8,1.5],[10,1.5],[12,1.5],[14,1.5]],'跨八度上行后折返，适合电子拨弦。'],
 ['arp-pedal','踏板交错','texture','分解和弦',Array.from({length:16},(_,i)=>[i, .72]),'低音踏板与高音和弦音交替，形成细密织体。']
];
for(const [id,name,role,sub,slots,desc]of parts){const notes=[],span=['clave-comp','long'].includes(id)?32:16;for(let offset=0;offset<32;offset+=span)slots.forEach(([step,dur],i)=>{let tones=id==='arp-up'?[ [60,64,67,72,76,72,67,64][i] ]:id==='arp-pedal'?[i%2===0?48:[64,67,72,67][Math.floor(i/2)%4]]:[60,64,67];tones.forEach((pitch,j)=>notes.push(N(pitch,offset+step,dur,.62-j*.045)));});template('part.'+id,name,role,sub,desc+' · C 大调参考，可按主音移调；请与目标和声核对。',notes,{presetId:id==='long'?'expansion.va.strings':id.startsWith('arp')?'expansion.fm.marble':'expansion.va.pulse-key'});}
for(const [id,name,sub,shape,desc]of [
 ['octave','迪斯科八度','八度与脉冲',[[0,0,1.3],[2,12,1.2],[4,0,1.3],[6,12,1.2],[8,0,1.3],[10,12,1.2],[12,7,1.3],[14,12,1.2]],'根音与高八度交替，尾部以五度过渡。'],
 ['walking','四分行走','行走与经过',[[0,0,3.4],[4,4,3.4],[8,7,3.4],[12,9,3.4],[16,10,3.4],[20,9,3.4],[24,7,3.4],[28,2,3.4]],'四分音符上行再下行，含属七色彩；适合 C7。'],
 ['tumbao','切分提前低音','切分与留白',[[6,7,4.7],[12,0,7.7],[22,7,4.7],[28,0,3.7]],'避开第一拍，从后半拍提前进入根音。'],
 ['dub','留白 Dub','切分与留白',[[2,0,3],[8,7,2],[11,12,3],[18,0,3],[24,7,2],[27,3,3]],'根音、五度和八度的稀疏应答，末尾小三度；适合 C 小调。'],
 ['motor','持续八分低音','八度与脉冲',Array.from({length:16},(_,i)=>[i*2,i===7||i===15?7:0,1.5]),'持续根音脉冲，句尾五度带动循环。']
]){const span=shape.at(-1)[0]<16?16:32,notes=[];for(let offset=0;offset<32;offset+=span)for(const [s,p,d]of shape)notes.push(N(36+p,s+offset,d,s%8===0?.8:.65));template('bass.'+id,name,'bass',sub,desc,notes,{scale:id==='dub'?'minor':'major',presetId:id==='dub'?'expansion.va.reese':id==='walking'?'studio.va.round':'expansion.fm.slap'});}
await writeFile(new URL('src/content/expansion-data.js',root),'/** Generated by scripts/expansion-build.mjs. */\n(function(G){G.EXPANSION_PACK='+JSON.stringify(pack)+';G.EXPANSION_FAMILIES='+JSON.stringify(families)+';G.EXPANSION_SOURCES='+JSON.stringify(sources)+';})(globalThis.GridTone ||= {});\n');
console.log('Expansion:',pack.presets.length,'sounds,',pack.templates.length,'patterns,',Object.keys(pack.assets).length,'short samples');
