/** Build deterministic original starter material and general harmonic recipes.
 * No copyrighted song melody or commercial loop is included. Sources in docs/SOURCES.md.
 */
import fs from 'node:fs';
import '../src/model.js';import '../src/music/progressions.js';
const G=globalThis.GridTone,root=new URL('../',import.meta.url),path=new URL('catalog/builtin.json',root),data=JSON.parse(fs.readFileSync(path,'utf8'));
const STEP=G.STEP,BAR=G.BAR,n=(pitch,step,dur=1,velocity=.7)=>({pitch,start:step*STEP,duration:dur*STEP,velocity});
const templates=[],drums=[];
const tpl=(id,name,role,bars,presetId,notes,description,bpm=100,scale='major')=>({id:'prism.'+id,version:1,type:'pattern',role,name,kind:role==='drums'?'drum':'melodic',bars,key:0,scale,presetId,...(role==='drums'?{drumkitId:'builtin.standard'}:{}),description,bpm,tags:[role==='drums'?'16 格节奏':'原创可改',scale==='minor'?'小调':'大调'],notes});
// Each row is kick, snare, closed hat, optional clap/open hat/side stick.
const beats=[
 ['pocket','口袋节奏',[0,7,10],[4,12],[0,2,4,6,8,10,12,14],{},'prism.drydrum',88,'底鼓错开规则重拍，军鼓稳在第二、第四拍；第二小节有轻微尾音。'],
 ['house','四踩 House',[0,4,8,12],[4,12],[2,6,10,14],{46:[6,14]},'prism.deepdrum',120,'每拍底鼓，反拍踩镲，第二与第四拍军鼓。适合先叠加和弦。'],
 ['disco','明亮 Disco',[0,4,8,12],[4,12],[0,2,4,6,8,10,12,14],{39:[4,12],46:[14]},'prism.deepdrum',116,'稳定四拍配八分镲片，第二、第四拍叠加拍手。'],
 ['halftime','半拍宽阔',[0,6,11],[8],[0,2,4,6,8,10,12,14],{},'prism.deepdrum',78,'军鼓落在第三拍，保持稀疏；可以写更长的旋律。'],
 ['trap','细碎半拍',[0,3,10],[8],[0,2,4,6,7,8,10,12,13,14,15],{39:[8]},'prism.deepdrum',74,'十六分镲片与半拍军鼓；本模板使用直网格，无三连滚奏。'],
 ['pop','清爽流行',[0,8,10],[4,12],[0,2,4,6,8,10,12,14],{},'prism.drydrum',104,'干净的底鼓和反拍军鼓，适合入门的四小节歌曲。'],
 ['rock','基础摇滚',[0,2,8,10],[4,12],[0,2,4,6,8,10,12,14],{49:[0]},'prism.drydrum',112,'成对底鼓加稳定八分音符镲片，首拍轻点吊镲。'],
 ['minimal','极简电子',[0,8],[12],[2,6,10,14],{37:[4]},'prism.deepdrum',108,'留出大块空白，用边击回应底鼓。'],
 ['break','切分碎拍',[0,6,10],[4,12],[0,2,3,6,8,10,11,14],{37:[15]},'prism.drydrum',110,'镲片断开后接短促尾音，保持第二、第四拍的重心。'],
 ['brush','轻刷午后',[0,8],[4,12],[0,4,8,12],{37:[6,14]},'prism.brushdrum',86,'柔软噪声军鼓与稀疏镲片；保留二、四拍。'],
 ['offbeat','反拍轻跳',[0,8],[4,12],[2,6,10,14],{37:[7,15]},'prism.drydrum',100,'反拍短镲配句末边击，适合轻快拨弦。'],
 ['electro','方格机能',[0,5,8,14],[4,12],[0,2,6,8,10,14],{39:[12],46:[7]},'prism.deepdrum',118,'底鼓加入十六分错位，镲片留下呼吸。'],
 ['dembow','拉丁切分练习',[0,8],[6,12],[0,2,4,6,8,10,12,14],{37:[3,11]},'prism.drydrum',96,'底鼓二分推进，军鼓在切分位置回应。入门型切分练习。'],
 ['clave','三二手敲',[0,8],[4,12],[2,6,10,14],{37:[0,6,12]},'prism.brushdrum',102,'两小节边击采用三加二的 clave 轮廓，鼓件保持克制。'],
 ['build','八分推进',[0,4,8,12],[4,12],[0,2,4,6,8,10,12,14],{39:[12]},'prism.drydrum',122,'第二小节末尾增加渐强军鼓，适合作为过渡。'],
 ['slow','安静呼吸',[0,10],[4,12],[0,4,8,12],{37:[7]},'prism.brushdrum',68,'慢速、疏落的起点；可以先只保留底鼓和军鼓。']
];
for(const [id,name,kick,snare,hat,extra,preset,bpm,description] of beats){
 const ns=[];for(let b=0;b<2;b++){
  kick.forEach((s,i)=>ns.push(n(36,b*16+s,1,i===0?.91:.76)));
  snare.forEach(s=>ns.push(n(38,b*16+s,1,.76)));
  hat.forEach((s,i)=>ns.push(n(42,b*16+s,1,i%2?.4:.57)));
  for(const [pitch,steps]of Object.entries(extra))steps.forEach(s=>{if(Number(pitch)===49&&b)return;if(Number(pitch)===37&&id==='clave'&&b)return;ns.push(n(Number(pitch),b*16+s,1,.5));});
 }
 if(id==='clave')[4,8].forEach(s=>ns.push(n(37,16+s,1,.65)));
 if(id==='build')[12,13,14,15].forEach((s,i)=>ns.push(n(38,16+s,1,.48+i*.12)));
 else if(!['minimal','slow','clave'].includes(id))ns.push(n(38,31,1,.29));
 const distinct=[...new Map(ns.map(x=>[x.pitch+':'+x.start,x])).values()].sort((a,b)=>a.start-b.start||a.pitch-b.pitch);
 const t=tpl('drum.'+id,name,'drums',2,preset,distinct,description,bpm);templates.push(t);drums.push(t);
}
// Original motifs over C–Am–F–G. Phrases use chord-tone anchors with passing tones and rests.
const melodies=[
 ['answer','短问长答',[[[4,0,2],[7,3,2],[9,6,2],[7,10,4]],[[9,0,3],[7,4,2],[4,8,6]],[[5,0,2],[9,3,2],[7,6,2],[5,10,4]],[[7,0,3],[2,4,2],[0,8,7]]],'prism.kalimba','短句留白，再用长音回答。末尾回到 C，形成清楚句读。'],
 ['steps','阶梯小句',[[[0,0,2],[2,2,2],[4,4,3],[7,10,5]],[[9,0,2],[7,2,2],[4,4,3],[0,10,5]],[[5,0,2],[7,2,2],[9,4,3],[12,10,5]],[[11,0,2],[9,2,2],[7,4,3],[0,10,5]]],'prism.lead','两个音级步进接一次小跳；四句长短相同，音高方向不同。'],
 ['echo','回声对话',[[[7,0,2],[4,4,3],[7,10,2]],[[9,0,2],[4,4,3],[9,10,2]],[[9,0,2],[5,4,3],[9,10,2]],[[7,0,2],[2,4,3],[0,10,5]]],'prism.glass','同一节奏重复四次，每次更换落点，适合短促的钟声。'],
 ['pent','五声小路',[[[0,0,2],[4,3,2],[7,6,3],[9,12,3]],[[9,0,3],[7,4,2],[4,8,6]],[[9,0,3],[7,4,2],[4,8,2],[2,12,3]],[[2,0,3],[7,4,2],[4,8,2],[0,12,3]]],'prism.wood','只用 C、D、E、G、A 五个音；以重复和留白建立轮廓。'],
 ['long','长音与气息',[[[4,0,11],[7,12,3]],[[9,0,7],[4,9,6]],[[5,0,11],[9,12,3]],[[7,0,7],[0,9,6]]],'prism.air','每句一到两个主要落点。适合气息音色，尾音间保留空隙。'],
 ['off','错开重拍',[[[4,2,3],[7,7,2],[4,12,3]],[[4,2,3],[9,7,2],[7,12,3]],[[5,2,3],[9,7,2],[12,12,3]],[[11,2,3],[7,7,2],[0,12,3]]],'prism.nylon','前两格留空，旋律从拍间进入；适合与稳定鼓点配合。'],
 ['arch','拱形线条',[[[0,0,2],[4,3,2],[7,6,2],[12,10,5]],[[12,0,2],[9,3,2],[7,6,2],[4,10,5]],[[5,0,2],[9,3,2],[12,6,2],[14,10,5]],[[14,0,2],[11,3,2],[7,6,2],[0,10,5]]],'prism.lead','两小节先上行再下降，把跨度控制在可唱的小句中。'],
 ['paired','双音节问候',[[[4,0,1],[7,2,3],[4,8,1],[7,10,3]],[[4,0,1],[9,2,3],[7,8,1],[4,10,3]],[[5,0,1],[9,2,3],[5,8,1],[9,10,3]],[[7,0,1],[11,2,3],[2,8,1],[0,10,5]]],'prism.celeste','短音接稍长的音，像几个相互呼应的音节。'],
 ['neighbour','绕一小圈',[[[4,0,2],[5,2,1],[4,3,3],[7,10,5]],[[9,0,2],[11,2,1],[9,3,3],[4,10,5]],[[5,0,2],[7,2,1],[5,3,3],[9,10,5]],[[7,0,2],[9,2,1],[7,3,3],[0,10,5]]],'prism.reed','邻近音回到原点，再落向另一个和弦音。'],
 ['sparse','六颗星',[[[7,2,6]],[[9,0,5],[4,10,5]],[[9,2,6]],[[7,0,5],[0,10,5]]],'prism.glass','四小节只有六个音。用时值和空间建立旋律。'],
 ['pluck','拨弦碎片',[[[0,0,1],[7,2,1],[4,5,2],[7,9,2],[12,12,3]],[[9,0,1],[4,2,1],[0,5,2],[4,9,2],[9,12,3]],[[5,0,1],[12,2,1],[9,5,2],[12,9,2],[17,12,3]],[[7,0,1],[14,2,1],[11,5,2],[7,9,2],[0,12,3]]],'prism.steel','分解和弦材料组织成短旋律，适合清楚起音的拨弦。'],
 ['resolve','向结尾收拢',[[[12,0,3],[7,4,3],[4,10,5]],[[12,0,3],[9,4,3],[4,10,5]],[[12,0,3],[9,4,3],[5,10,5]],[[11,0,2],[7,3,2],[2,6,2],[0,10,6]]],'prism.clarinet','前三小节保留相同高音，第四句下行回到主音。']
];
for(const [id,name,bars,preset,description] of melodies){const ns=bars.flatMap((b,i)=>b.map(([pitch,s,d])=>n(60+pitch,i*16+s,d,.7-(s%4? .08:0))));templates.push(tpl('melody.'+id,name,'melody',4,preset,ns,description+' 原参考和声：C–Am–F–G。',96));}
const basses=[['roots','根音支撑',[[0,0,15]],'每小节一个长根音，先把和声地基搭起来。'],['quarters','四拍脉搏',[[0,0,3],[0,4,3],[0,8,3],[0,12,3]],'稳稳落在四拍，适合对齐基础鼓点。'],['octaves','跳八度',[[0,0,2],[12,2,2],[0,4,2],[12,6,2],[0,8,2],[12,10,2],[0,12,2],[12,14,2]],'高低八度交替，形成鲜明舞曲脉搏。'],['fifths','根音与五度',[[0,0,3],[7,4,3],[0,8,3],[7,12,3]],'根音与纯五度交替，简单而有轮廓。'],['sync','切分低音',[[0,0,3],[0,6,2],[7,10,2],[12,14,2]],'重音后留白，在拍间加入回应。'],['space','呼吸低音',[[0,0,5],[7,10,3]],'每小节只用两个音，给旋律留空间。'],['push','提前半拍',[[0,0,3],[7,6,2],[0,8,3],[12,14,2]],'后半小节加入八度，推向下一次和弦变化。'],['down','八度落点',[[12,0,3],[7,4,3],[0,8,7]],'由高向低落下；适合需要收拢的段落。']];
for(const [id,name,shape,description] of basses){const ns=[0,9,5,7].flatMap((root,b)=>shape.map(([pitch,s,d])=>n(36+root+pitch,b*16+s,d,s===0?.8:.65)));templates.push(tpl('bass.'+id,name,'bass',4,id==='octaves'?'prism.rubberbass':'prism.roundbass',ns,description+' 原参考和声：C–Am–F–G。',100));}
for(const recipe of G.PROGRESSIONS){const g=G.generateProgression(recipe.id,{key:recipe.scale==='minor'?9:0});templates.push({...g.template,id:'prism.chords.'+recipe.id.slice(12),bpm:96});}
// Three configurable eight-piece kits with genuinely different per-row engine profiles.
const standard=data.drumkits.find(k=>k.id==='builtin.standard');
const kits=[['deep','深踢电子鼓','prism.deepdrum'],['dry','干净口袋鼓','prism.drydrum'],['brush','柔刷鼓组','prism.brushdrum']].map(([id,name,presetId])=>({id:'prism.kit.'+id,version:1,name,rows:standard.rows.map(x=>({...x,source:{...x.source,presetId}}))}));
function makeSong(id,name,recipeId,bpm,lead,beatId){
 const q=G.blankProject();q.title=name;q.bars=8;q.bpm=bpm;q.key=0;q.tracks=[];const recipe=G.PROGRESSIONS.find(x=>x.id===recipeId);q.scale=recipe.scale;
 const chords=G.generateProgression(recipeId,{key:0}).template,beat=drums.find(x=>x.id==='prism.drum.'+beatId);
 const bass=tpl('tmp','贝斯','bass',4,'prism.roundbass',recipe.chords.flatMap((c,b)=>[n(36+c.offset,b*16,6,.77),n(36+c.offset,b*16+8,5,.62)]),'');
 const mel=tpl('tmp2','旋律','melody',4,lead,recipe.chords.flatMap((c,b)=>{const sh=G.CHORD_SHAPES[c.quality];const anchor=60+c.offset;return [[sh[1],0,2],[sh[2],3,2],[sh[1],6,3],[sh[0]+(b===3?0:12),11,4]].map(([p,s,d])=>n(anchor+p,b*16+s,d,s===0?.73:.59));}),'');
 for(const [i,tpl,vol]of [[0,chords,.66],[1,bass,.72],[2,beat,.69],[3,mel,.70]]){
  const tr=G.newTrack(tpl.kind,i,tpl.presetId);tr.name=['和弦 · '+name,'圆润低音',beat.name,'主旋律'][i];tr.volume=vol;tr.pan=[-.12,0,0,.15][i];tr.fx.reverb=i===2?.08:i===3?.26:.16;tr.fx.delay=i===3?.11:0;tr.sound.release=i===3?.48:.32;
  const pat=G.newPattern(['和弦','贝斯','节奏','旋律'][i],tpl.bars);pat.notes=tpl.notes.map(x=>({...x,id:G.uid('n')}));tr.patterns=[pat];tr.clips=Array.from({length:8/pat.bars},(_,b)=>({id:G.uid('c'),patternId:pat.id,bar:b*pat.bars}));
  if(i===3){const v=G.copyPattern(pat);v.name='旋律 · 回答';v.notes.at(-1).pitch=60;v.notes.at(-1).duration=5*STEP;tr.patterns.push(v);tr.clips[1].patternId=v.id;}
  q.tracks.push(tr);
 }
 // Stable distribution IDs; applyTemplate generates fresh IDs for every opened copy.
 q.id='starter-'+id;q.tracks.forEach((t,i)=>{t.id=`${id}-t${i}`;const map=new Map();t.patterns.forEach((p,j)=>{const old=p.id;p.id=`${id}-t${i}-p${j}`;map.set(old,p.id);p.notes.forEach((n,k)=>n.id=`${id}-t${i}-p${j}-n${k}`);});t.clips.forEach((c,j)=>{c.id=`${id}-t${i}-c${j}`;c.patternId=map.get(c.patternId);});});
 return{id:'prism.song.'+id,version:1,type:'song',role:'song',name,description:'原创八小节起点 · '+recipe.roman+'。和弦、贝斯、节奏、旋律都能拆开修改。',tags:['四轨起点','原创'],bpm,project:G.validateProject(q)};
}
templates.unshift(makeSong('glass','玻璃小夜曲','progression.soft',92,'prism.kalimba','brush'),makeSong('walk','轻快步伐','progression.doo',108,'prism.nylon','pop'),makeSong('radio','夜色电台','progression.minor-axis',80,'prism.reed','halftime'),makeSong('pulse','微光脉冲','progression.pop',116,'prism.lead','house'));
data.templates=[...templates,...data.templates.filter(x=>!x.id.startsWith('prism.'))];data.drumkits=[...data.drumkits.filter(x=>!x.id.startsWith('prism.')), ...kits];
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(`Content: ${data.templates.length} templates (${templates.length} new), ${data.drumkits.length} drum kits, ${G.PROGRESSIONS.length} progression recipes.`);
