/** Musical recipes: harmonic skeletons, not recordings or copied song melodies.
 * Pitch classes are explicit; changing reference/display never rewrites old notes.
 * Close-position voice leading minimizes movement; it is not a four-part harmony solver.
 */
(function(G){'use strict';
 const Q=Object.freeze({...G.CHORDS,dim:[0,3,6],halfDim:[0,3,6,10],add9:[0,4,7,14]});
 const names={major:'',minor:'m',maj7:'maj7',min7:'m7',dom7:'7',sus2:'sus2',sus4:'sus4',dim:'dim',halfDim:'m7♭5',add9:'add9'};
 const rows=[
 ['pop','流行起点','流行与民谣','major','I – V – vi – IV','明亮而带一点留恋。每小节一个和弦，适合先写主旋律。',[[0,'major'],[7,'major'],[9,'minor'],[5,'major']]],
 ['axis','从低落走向明亮','流行与民谣','major','vi – IV – I – V','同一组和弦换一个起点，重心落在相对小调。',[[9,'minor'],[5,'major'],[0,'major'],[7,'major']]],
 ['doo','温柔回环','流行与民谣','major','I – vi – IV – V','短句反复很好用，最后的属和弦自然接回开头。',[[0,'major'],[9,'minor'],[5,'major'],[7,'major']]],
 ['folk','民谣四步','流行与民谣','major','I – IV – V – IV','三个基础和弦，留出充足旋律空间。',[[0,'major'],[5,'major'],[7,'major'],[5,'major']]],
 ['lift','向上展开','流行与民谣','major','I – IV – vi – V','先展开，再经过小和弦，最后保持向前的感觉。',[[0,'major'],[5,'major'],[9,'minor'],[7,'major']]],
 ['home','清楚的结尾','流行与民谣','major','I – V – IV – I','第四小节回到主和弦，适合完整的小段落。',[[0,'major'],[7,'major'],[5,'major'],[0,'major']]],
 ['canon','八小节连绵','流行与民谣','major','I – V – vi – iii – IV – I – IV – V','八个和弦的顺次展开。配分解弹奏可形成连贯伴奏。',[[0,'major'],[7,'major'],[9,'minor'],[4,'minor'],[5,'major'],[0,'major'],[5,'major'],[7,'major']]],
 ['soft','七和弦回环','柔和与七和弦','major','Imaj7 – vi7 – ii7 – V7','用七和弦增加色彩，适合电钢琴和放松的节奏。',[[0,'maj7'],[9,'min7'],[2,'min7'],[7,'dom7']]],
 ['window','两扇窗','柔和与七和弦','major','Imaj7 – IVmaj7 – Imaj7 – IVmaj7','只在两个和弦之间呼吸，适合稀疏旋律和长音。',[[0,'maj7'],[5,'maj7'],[0,'maj7'],[5,'maj7']]],
 ['royal','渐渐展开','柔和与七和弦','major','IVmaj7 – V7 – iii7 – vi7','从下属和弦出发，经由中音和弦落向相对小调。',[[5,'maj7'],[7,'dom7'],[4,'min7'],[9,'min7']]],
 ['sus','悬浮的四格','柔和与七和弦','major','Isus2 – IVadd9 – vi7 – Vsus4','挂留与附加音让和弦更通透，最后保持未解决的期待。',[[0,'sus2'],[5,'add9'],[9,'min7'],[7,'sus4']]],
 ['sunset','落日余温','柔和与七和弦','major','Imaj7 – iii7 – IVmaj7 – V7','前三步舒展，最后回到清楚的回归方向。',[[0,'maj7'],[4,'min7'],[5,'maj7'],[7,'dom7']]],
 ['minor-axis','夜色循环','小调','minor','i – VI – III – VII','自然小调常用的四和弦关系；适合安静或有力量的旋律。',[[0,'minor'],[8,'major'],[3,'major'],[10,'major']]],
 ['minor-descent','小调下行','小调','minor','i – VII – VI – VII','根音下行又折返，保留循环感。',[[0,'minor'],[10,'major'],[8,'major'],[10,'major']]],
 ['minor-fifth','小调展开','小调','minor','i – iv – VII – III','先留在小调，再走向相对大调的区域。',[[0,'minor'],[5,'minor'],[10,'major'],[3,'major']]],
 ['minor-return','小调归途','小调','minor','i – VI – iv – V7','最后使用大属七和弦，包含升高的导音，回到小主和弦。',[[0,'minor'],[8,'major'],[5,'minor'],[7,'dom7']]],
 ['andalusian','步步下行','小调','minor','i – VII – VI – V7','持续下行到属和弦。V7 含自然小调之外的升导音。',[[0,'minor'],[10,'major'],[8,'major'],[7,'dom7']]],
 ['minor-breath','两种阴影','小调','minor','i7 – iv7 – i7 – iv7','小七和弦的两步交换，可留更多空间给节奏。',[[0,'min7'],[5,'min7'],[0,'min7'],[5,'min7']]],
 ['251','大调 ii–V–I','爵士与回转','major','ii7 – V7 – Imaj7 – Imaj7','经典的准备、张力与解决。主和弦停留两个小节。',[[2,'min7'],[7,'dom7'],[0,'maj7'],[0,'maj7']]],
 ['6251','六二五一','爵士与回转','major','vi7 – ii7 – V7 – Imaj7','按五度关系回到主和弦，第四小节有明确落点。',[[9,'min7'],[2,'min7'],[7,'dom7'],[0,'maj7']]],
 ['3625','三六二五','爵士与回转','major','iii7 – vi7 – ii7 – V7','连续向前的回转，可接回主和弦继续下一句。',[[4,'min7'],[9,'min7'],[2,'min7'],[7,'dom7']]],
 ['2516','解决后继续','爵士与回转','major','ii7 – V7 – Imaj7 – vi7','解决后落到六级，便于继续下一轮。',[[2,'min7'],[7,'dom7'],[0,'maj7'],[9,'min7']]],
 ['minor251','小调 ii–V–i','爵士与回转','minor','iiø7 – V7 – i7 – i7','半减七和弦准备、大属七带来升导音，再回到小调。',[[2,'halfDim'],[7,'dom7'],[0,'min7'],[0,'min7']]],
 ['secondary','明亮的回转','爵士与回转','major','Imaj7 – VI7 – ii7 – V7','VI7 作为 ii 的副属和弦，包含调外音，增加前进感。',[[0,'maj7'],[9,'dom7'],[2,'min7'],[7,'dom7']]]
 ];
 const PROGRESSIONS=rows.map(([id,name,group,scale,roman,description,chords])=>Object.freeze({id:'progression.'+id,name,group,scale,roman,description,chords:chords.map(([offset,quality])=>({offset,quality})),bars:chords.length}));
 function chordName(c,key){const k=((key+c.offset)%12+12)%12;return G.KEYS[k]+names[c.quality];}
 function voiced(root,quality,style,previous){
  const shape=Q[quality];if(!shape)throw Error('未知和弦类型。');
  const base=shape.map(n=>root+n);
  if(style==='root')return base;
  if(style==='open'){const out=[...base];if(out.length>2)out[1]+=12;return out.sort((a,b)=>a-b);}
  const candidates=[];
  for(let octave=-1;octave<=1;octave++)for(let inv=0;inv<base.length;inv++){
   const c=base.map((p,i)=>p+octave*12+(i<inv?12:0)).sort((a,b)=>a-b);
   if(c[0]>=48&&c.at(-1)<=86)candidates.push(c);
  }
  const score=c=>{const center=c.reduce((a,b)=>a+b,0)/c.length;
   if(!previous)return Math.abs(center-64)+Math.abs(c[0]-root)*.12;
   const distance=c.reduce((sum,p,i)=>sum+Math.abs(p-previous[Math.min(i,previous.length-1)]),0);
   return distance+Math.abs(center-64)*.15;};
  return candidates.sort((a,b)=>score(a)-score(b)||a[0]-b[0])[0]||base;
 }
 function generateProgression(id,options={}){
  const p=PROGRESSIONS.find(x=>x.id===id);if(!p)throw Error('找不到和弦进行。');
  const key=Number(options.key??0),style=options.voicing||'smooth',rhythm=options.rhythm||'whole';
  if(!Number.isInteger(key)||key<0||key>11)throw Error('主音必须是 0–11。');
  if(!['smooth','root','open'].includes(style)||!['whole','pulse','arp','strum'].includes(rhythm))throw Error('排列或弹奏方式无效。');
  const notes=[],voicings=[];let previous=null;
  const harmony={version:1,events:p.chords.map((c,i)=>({start:i*G.BAR,duration:G.BAR,rootPitchClass:(key+c.offset)%12,quality:c.quality})),source:{recipeId:p.id,recipeVersion:1},confirmedMusicHash:'pending'};
  p.chords.forEach((chord,bar)=>{
   // Fit roots into one mid-register octave before inversion; all source intervals remain exact.
   const root=48+(key+chord.offset)%12,vs=voiced(root,chord.quality,style,previous);previous=vs;voicings.push(vs);
   const add=(pitch,step,dur,velocity)=>notes.push({pitch,start:bar*G.BAR+step*G.STEP,duration:dur*G.STEP,velocity});
   if(rhythm==='arp'){const seq=[0,1,2,1,vs.length-1,1,2,1];seq.forEach((i,s)=>add(vs[Math.min(i,vs.length-1)],s*2,1.7,s%4===0?.77:.64));}
   else if(rhythm==='pulse'){for(let beat=0;beat<4;beat++)vs.forEach((pitch,i)=>add(pitch,beat*4,2.8,(beat===0?.7:.56)-(i*.035)));}
   else if(rhythm==='strum')vs.forEach((pitch,i)=>add(pitch,i,15.8-i,.74-i*.055));
   else vs.forEach((pitch,i)=>add(pitch,0,15.8,.72-i*.045));
  });
  return {template:{id:p.id+'.generated',version:1,type:'pattern',role:'chords',name:p.name,description:p.roman+' · '+p.description,kind:'melodic',bars:p.bars,key,scale:p.scale,presetId:'prism.tine',tags:[p.group,rhythm],notes,harmony},chords:p.chords.map(c=>chordName(c,key)),voicings,recipe:p};
 }
 Object.assign(G,{PROGRESSIONS,CHORD_SHAPES:Q,generateProgression,progressionChordName:chordName});
})(globalThis.GridTone ||= {});
