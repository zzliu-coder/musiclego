(function(G){'use strict';
 function recipeProject(id,{key=0,seed=1}={}){
  const recipe=G.RECIPES.find(r=>r.id===id);if(!recipe)throw Error('配方不存在。');
  const g=G.generateProgression('progression.'+recipe.progression,{key,rhythm:recipe.rhythm}),p=G.blankProject();p.title=recipe.name;p.bars=recipe.answer?8:g.template.bars;p.bpm=recipe.bpm;p.swing=recipe.swing;p.key=key;p.scale=g.template.scale;
  const make=(role,preset,name)=>{const t=G.newTrack(role==='drums'?'drum':'melodic',0,preset);t.role=role;t.color={drums:'#f66570',bass:'#34b995',chords:'#ee9552',melody:'#2875f5'}[role];t.name=name;t.patterns[0].bars=p.bars;t.patterns[0].name=name+' A';t.volume=role==='melody'?.52:role==='chords'?.4:.56;return t;};
  const chords=make('chords',recipe.chordPreset,'和弦'),drums=make('drums','drums','鼓点'),bass=make('bass',recipe.bassPreset,'贝斯'),melody=make('melody',recipe.melodyPreset,'示范旋律'),blank=make('melody',recipe.melodyPreset,'我的旋律');
  p.tracks=[chords,drums,bass,melody,blank];
  const cp=chords.patterns[0],repeats=p.bars/g.template.bars;
  cp.notes=Array.from({length:repeats},(_,i)=>g.template.notes.map(n=>({...n,id:G.uid('n'),start:n.start+i*g.template.bars*G.BAR}))).flat();
  const h=G.clone(g.template.harmony);h.events=Array.from({length:repeats},(_,i)=>h.events.map(e=>({...e,start:e.start+i*g.template.bars*G.BAR}))).flat();G.confirmHarmony(cp,h);
  const add=(pitch,bar,beat,velocity=.65)=>drums.patterns[0].notes.push(G.newNote(pitch,bar*G.BAR+beat*G.PPQ,G.STEP,velocity));
  for(let b=0;b<p.bars;b++){
   const style=recipe.drumStyle;
   for(const beat of style==='four'?[0,1,2,3]:style==='drive'?[0,1.5,2,2.5]:style==='half'?[0,2.5]:style==='sparse'?[0,2.5]:[0,2])add(36,b,beat,.76);
   for(const beat of style==='half'?[2]:style==='light'?[3]:[1,3])add(style==='light'?37:38,b,beat,.6);
   for(let beat=0;beat<4;beat+=style==='light'||style==='sparse'?1:.5)add(42,b,beat,beat%1===0?.38:.27);
  }
  const target=t=>({trackId:t.id,clipId:t.clips[0].id});
  const bassCandidate=G.generateEnsemble(p,target(bass),{mode:'bass',sourceTrackId:chords.id,referenceTrackId:recipe.drumStyle==='four'||recipe.drumStyle==='drive'?drums.id:undefined,strategy:recipe.drumStyle==='four'?'answer':'align'},seed);
  bass.patterns[0].notes=bassCandidate.notes.map(n=>({...n,id:G.uid('n')}));bass.patterns[0].generation=bassCandidate.generation;
  const harmony=G.resolveHarmony(p,{...target(melody),sourceTrackId:chords.id});
  const candidates=G.generateMelody({harmony,notes:[]},{density:recipe.density},seed).candidates;
  const chosen=candidates[0];melody.patterns[0].notes=chosen.notes.map(n=>({...n,id:G.uid('n')}));melody.patterns[0].generation=chosen.generation;
  if(recipe.pentatonic)melody.patterns[0].notes.forEach(n=>n.pitch=G.snapPitch(n.pitch,key,'pentatonic'));
  if(recipe.answer){const response=G.generateMelody({harmony,notes:melody.patterns[0].notes},{mode:'answer',start:4*G.BAR,end:8*G.BAR},seed+1).candidates[0];if(response){melody.patterns[0].notes=response.notes.map(n=>({...n,id:G.uid('n')}));melody.patterns[0].generation=response.generation;}}
  for(const t of p.tracks)G.pinPreset(p,t.preset);G.pinDocument(p);G.assertPlayable(p);
  return G.validateProject(p);
 }
 function applyRecipe(project,id,{bar=0,key=project.key,seed=1,tempo=false}={}){
  const recipe=recipeProject(id,{key,seed});
  if(!Number.isInteger(bar)||bar<0||bar+recipe.bars>G.LIMITS.bars)throw Error('配方超出歌曲范围。');
  if(project.tracks.length+recipe.tracks.length>G.LIMITS.tracks)throw Error('配方需要 5 条轨道，当前轨道空间不足。');
  const p=G.clone(project);p.bars=Math.max(p.bars,bar+recipe.bars);
  for(const t of recipe.tracks){for(const c of t.clips)c.bar+=bar;p.tracks.push(t);}
  for(const t of recipe.tracks)for(const pat of t.patterns)for(const ref of pat.generation?.sources||[])ref.hash=G.sourceHash(p.tracks.find(x=>x.id===ref.trackId));
  if(tempo){p.bpm=recipe.bpm;p.swing=recipe.swing;}
  G.pinDocument(p);
  const t=p.tracks.at(-1);return {project:G.validateProject(p),trackId:t.id,patternId:t.patterns[0].id,clipId:t.clips[0].id,trackIds:recipe.tracks.map(t=>t.id),range:[bar*G.BAR,(bar+recipe.bars)*G.BAR]};
 }
 function arrangeSections(project,{bar=project.bars,bars=8,sourceBar=0,style='variation',trackIds=project.tracks.map(t=>t.id)}={}){
  if(![8,16].includes(bars)||!Number.isInteger(bar)||bar<0||bar+bars>G.LIMITS.bars)throw Error('请选择有效的 8 或 16 小节编排范围。');
  if(!['variation','entry','repeat'].includes(style))throw Error('编排方式无效。');
  if(!Number.isInteger(sourceBar)||sourceBar<0||!project.tracks.some(t=>trackIds.includes(t.id)&&t.clips.some(c=>c.bar===sourceBar)))throw Error('起点没有可用片段，请选择材料所在小节。');
  const p=G.clone(project);p.bars=Math.max(p.bars,bar+bars);
  const created=[];
  for(const t of p.tracks.filter(t=>trackIds.includes(t.id))){
   const source=t.clips.find(c=>c.bar===sourceBar),pat=t.patterns.find(p=>p.id===source?.patternId);if(!pat)continue;
   if(pat.bars>bars||bars%pat.bars)throw Error('源片段长度无法完整放入这个编排，请选择 4 或 8 小节材料。');
   for(let offset=0;offset<bars;offset+=pat.bars){
    if(style==='entry'&&t.role==='melody'&&offset===0)continue;
    let next=pat;
    if(offset&&style==='variation'){
     next=G.copyPattern(pat);next.name=pat.name+(offset+pat.bars===bars?' · 结尾':' · 回答');
     const sources=project.tracks.filter(tr=>tr.patterns.some(p=>p.harmony));
     if(t.role==='melody'&&pat.notes.length&&sources.length===1&&[4,8].includes(pat.bars)){
      const harmony=G.resolveHarmony(project,{trackId:t.id,clipId:source.id,sourceTrackId:sources[0].id});
      const mode=offset+pat.bars===bars?'ending':'answer';
      const c=G.generateMelody({harmony,notes:next.notes,retention:next.retention},{mode,low:Math.max(0,Math.min(...next.notes.map(n=>n.pitch))+t.pipeline.transpose-3),high:Math.min(127,Math.max(...next.notes.map(n=>n.pitch))+t.pipeline.transpose+3)},offset+31).candidates[0];
      if(c){const existing=new Set(next.notes.map(n=>n.id));next.notes=c.notes.map(n=>({...n,id:existing.has(n.id)?n.id:G.uid('n')}));next.generation=c.generation;created.push(next);}
     }else{
     const protectedIds=new Set(next.retention?.notes.map(n=>n.id)||[]);
     const changed=next.notes.filter(n=>!protectedIds.has(n.id)&&!next.retention?.ranges.some(r=>n.start<r.end&&n.start+n.duration>r.start));
     if(changed.length){const last=changed.at(-1);last.velocity=Math.max(.1,last.velocity*.8);if(t.kind!=='drum')last.duration=Math.min(next.bars*G.BAR-last.start,last.duration*1.5);else next.notes=next.notes.filter(n=>n!==last);}
     }
     if(next.harmony)G.confirmHarmony(next,next.harmony);t.patterns.push(next);
    }
    if(!G.canPlace(t,next,bar+offset,p.bars))throw Error('编排目标已有片段，请选择空白位置。');
    t.clips.push({id:G.uid('c'),patternId:next.id,bar:bar+offset});
   }
  }
  for(const pat of created)for(const ref of pat.generation.sources)ref.hash=G.sourceHash(p.tracks.find(t=>t.id===ref.trackId));
  return G.validateProject(p);
 }
 function suggestedMix(project){const p=G.clone(project);for(const t of p.tracks){if(t.role==='melody'){t.volume=.55;t.pan=0;}else if(t.role==='bass'){t.volume=.58;t.pan=0;}else if(t.role==='chords'){t.volume=.4;t.pan=-.12;}else if(t.role==='drums'){t.volume=.55;t.pan=0;}else if(t.role==='texture'){t.volume=.3;t.pan=.15;}}return G.validateProject(p);}
 Object.assign(G,{recipeProject,applyRecipe,arrangeSections,suggestedMix});
})(globalThis.GridTone ||= {});
