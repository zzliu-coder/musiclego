/** Curated metadata is separate from stable sounds and musical documents.
 * Family grouping changes discovery only: legacy IDs and old audio remain intact. */
(function(G){'use strict';
 G.BUNDLED_CATALOG_IDS=['studio.library.v1'];G.installCatalog(G.STUDIO_PACK);
 if(G.EXPANSION_PACK){G.installCatalog(G.EXPANSION_PACK);G.BUNDLED_CATALOG_IDS.push(G.EXPANSION_PACK.id);Object.assign(G.STUDIO_SOURCES,G.EXPANSION_SOURCES);}
 const familyById=new Map([...G.STUDIO_FAMILIES,...(G.EXPANSION_FAMILIES||[])].map(f=>[f.id,G.clone(f)]));
 for(const p of G.PROGRESSIONS){
  familyById.set('family.'+p.id,{id:'family.'+p.id,name:p.name,kind:'rhythm',role:'chords',subcategory:p.group,description:p.roman+' · '+p.description,members:[p.id+'.generated'],defaultId:p.id+'.generated',tags:[p.group,'和弦进行']});
 }
 // Metadata only: no changes to the old material or musical definitions.
 const groups={'hand-pop':'流行与直拍','hand-soul':'放克与灵魂','hand-fill':'过门与收尾',four:'四拍舞曲',pocket:'嘻哈与半拍',broken:'碎拍',motor:'四拍舞曲',airy:'氛围与留白',shuffle:'摇摆',bounce:'八度与脉冲',anchor:'根音与长音',sync:'切分与留白',stabs:'反拍与切分',arp:'分解和弦'};
 for(const f of familyById.values())f.subcategory??=f.kind==='sound'?(f.id.includes('fm')||f.id.includes('metal')||f.id.includes('digital')?'FM 数字':f.role==='drums'?'合成鼓组':'模拟电路'):groups[f.id.slice(7)]||({melody:'动机与乐句',song:'完整组合'})[f.role]||'其他材料';
 const related={
  'family.analog-bass':['roundbass','subbass','prism.roundbass'],
  'family.resonant-bass':['acidbass','prism.rubberbass'],
  'family.analog-lead':['sawlead','sinelead','prism.lead','prism.pulse','chip'],
  'family.synth-chords':[],
  'family.retro-pad':['warmpad','strings'],
  'family.motion-pad':['cloudpad','prism.choirpad'],
  'family.fm-ep':['epiano','prism.tine','prism.reed'],
  'family.fm-bass':['fmbass'],
  'family.fm-pluck':['chippluck'],
  'family.metal-keys':['bell','toy','prism.glass','prism.vibes','vibes'],
  'family.digital-tone':['organ','fmlead'],
  'family.digital-motion':['prism.glasspad','prism.celeste'],
  'family.electronic-kits':['drums','softdrums','prism.deepdrum','prism.drydrum','prism.brushdrum']
 };
 for(const [id,ids]of Object.entries(related)){const f=familyById.get(id);f.legacyMembers=ids;}
 for(const [id,name,role,members]of [
  ['original-plucks','拨弦与木质','melody',['prism.nylon','prism.steel','prism.mutepluck','pluck','harp','prism.wood','marimba','prism.kalimba','kalimba']],
  ['original-air','管乐与气息','melody',['prism.air','prism.clarinet','air']],
  ['original-piano','基础钢琴','chords',['felt','brightpiano']]
 ])familyById.set('family.'+id,{id:'family.'+id,name,kind:'sound',role,description:'保留的原有声音，已合并为家族入口。',members,defaultId:members[0],tags:['原有精选'],legacy:false});
 const oldRecipeProject=G.recipeProject,oldApplyRecipe=G.applyRecipe;
 const newNote=(p,s,d,v)=>G.newNote(G.clamp(Math.round(p),0,127),s,Math.max(1,d),G.clamp(v,.01,1));
 function makeCombo(id,{key,seed=1,ending=false}={}){
  const c=G.STUDIO_COMBOS.find(c=>c.id===id);if(!c)return oldRecipeProject(id,{key:key??0,seed});
  key??=c.key;ending=ending||c.variantMode==='ending';const sparse=c.variantMode==='sparse';const p=G.blankProject();p.title=c.name;p.key=key;p.bpm=c.bpm;p.bars=8;p.swing=0;
  const g=G.generateProgression('progression.'+c.progression,{key,rhythm:'whole',voicing:'smooth'});p.scale=g.template.scale;
  const make=(role,preset,name)=>{const t=G.newTrack(role==='drums'?'drum':'melodic',0,'studio.'+preset);t.role=role;t.name=name;t.patterns[0].bars=8;t.patterns[0].name=c.name+' · '+name;t.color=({drums:'#dc6274',bass:'#339784',chords:'#d98f47',melody:'#3270c7'})[role];t.volume=role==='drums'?.61:role==='bass'?.61:role==='chords'?.48:.5;t.fx={reverb:role==='drums'?.04:role==='bass'?0:role==='chords'?.2:.17,delay:0,drive:0};return t;};
  const d=make('drums','drum.'+c.drum,'鼓'),b=make('bass',c.bass,'贝斯'),h=make('chords',c.chords,'和弦'),m=make('melody',c.melody,'示范旋律'),blank=make('melody',c.melody,'我的旋律');
  p.tracks=[d,b,h,m,blank];d.drumkitId='builtin.standard';h.pan=-.12;
  const df=familyById.get('family.'+c.rhythmFamily),base=G.getTemplate(df.members[0]),variation=G.getTemplate(df.members[Math.min(df.members.length-1,df.members.length>=5?(ending?4:3):1)]);
  for(const [part,offset]of [[base,0],[variation,4*G.BAR]])d.patterns[0].notes.push(...part.notes.map(n=>({...n,id:G.uid('n'),start:n.start+offset,performed:true})));
  const hp=h.patterns[0];hp.harmony={version:1,confirmedMusicHash:'pending',source:{recipeId:c.id,recipeVersion:c.version},events:[]};
  const bassShapes={anchor:[[0,5,0],[6,1,7],[8,5,0],[14,1,12]],sync:[[0,3,0],[5,1,7],[7,2,12],[10,3,0],[14,1,7]],bounce:[[0,2,0],[3,2,0],[6,1,7],[8,2,0],[11,2,12],[14,1,7]]};
  for(let bar=0;bar<8;bar++){
   const e=g.template.harmony.events[bar%4],tones=g.voicings[bar%4],root=36+e.rootPitchClass;hp.harmony.events.push({...G.clone(e),start:bar*G.BAR});
   const starts=c.chordStyle==='whole'?[0]:c.chordStyle==='pulse'?[0,8]:c.chordStyle==='sync'?[2,6,10,14]:[0,2,4,6,8,10,12,14];
   for(let i=0;i<starts.length;i++){
    const step=starts[i];if(ending&&bar===7&&step>8)continue;
    const pitches=c.chordStyle==='arp'?[tones[[0,1,2,1,3,2,1,0][i]%tones.length]]:tones;
    const duration=c.chordStyle==='whole'?G.BAR-120:c.chordStyle==='pulse'?6*G.STEP:c.chordStyle==='arp'?1.65*G.STEP:1.4*G.STEP;
    pitches.forEach((pitch,j)=>hp.notes.push(newNote(pitch,bar*G.BAR+step*G.STEP,duration,.59-j*.025)));
   }
   for(const [step,length,interval]of bassShapes[c.bassPattern]){
    if(c.baseId==='studio.combo.air'&&step!==0)continue;if(ending&&bar===7&&step>8)continue;
    b.patterns[0].notes.push(newNote(root+interval,bar*G.BAR+step*G.STEP,length*G.STEP,step===0?.76:.62));
   }
   // A recognizable two-bar gesture returns, then changes its ending in bars 4 and 8.
   for(let i=0;i<c.melodySteps.length;i++){
    const step=c.melodySteps[i];if(bar%4===3&&i>c.melodySteps.length/2)continue;
    let pitch=60+key+c.motif[(i+(bar%2===1?1:0))%c.motif.length]+12;
    pitch=i===0||step%4===0?tones[(i+bar%2)%tones.length]+12:G.snapPitch(pitch,key,p.scale);
    pitch=G.clamp(pitch,60,88);const next=c.melodySteps[i+1]??16;
    const duration=Math.max(120,(next-step)*G.STEP*(c.baseId==='studio.combo.air'?.82:.67));
    m.patterns[0].notes.push(newNote(pitch,bar*G.BAR+step*G.STEP,duration,i===0?.68:.54));
   }
  }
  if(sparse){d.patterns[0].notes=d.patterns[0].notes.filter((n,i)=>![42,46,37].includes(n.pitch)||i%2===0);b.patterns[0].notes=b.patterns[0].notes.filter(n=>n.start%G.BAR<6*G.STEP);m.patterns[0].notes=m.patterns[0].notes.filter((n,i)=>i%2===0);}
  if(ending){
   const quality=p.scale==='minor'?'minor':'major',tonic=G.CHORD_SHAPES[quality];
   hp.notes=hp.notes.filter(n=>n.start<7*G.BAR);tonic.forEach((interval,i)=>hp.notes.push(newNote(60+key+interval,7*G.BAR,G.BAR-120,.61-i*.035)));
   hp.harmony.events[7]={start:7*G.BAR,duration:G.BAR,rootPitchClass:key,quality};
   b.patterns[0].notes=b.patterns[0].notes.filter(n=>n.start<7*G.BAR);b.patterns[0].notes.push(newNote(36+key,7*G.BAR,3*G.PPQ,.7));
   d.patterns[0].notes=d.patterns[0].notes.filter(n=>n.start<7*G.BAR+G.PPQ*2);
   const notes=m.patterns[0].notes.filter(n=>n.start<7*G.BAR+G.PPQ);notes.push(newNote(72+key,7*G.BAR+G.PPQ,2.7*G.PPQ,.62));m.patterns[0].notes=notes;
  }
  G.confirmHarmony(hp,hp.harmony);for(const t of p.tracks){t.patterns[0].material={id:c.id,version:c.version,part:t.role};G.annotateStudioMaterial?.(t.patterns[0],t.role==='drums'?base.id:c.id);if(t.role==='drums'&&variation.id!==base.id)G.annotateStudioMaterial?.(t.patterns[0],variation.id);G.pinPreset(p,t.preset);}G.pinDocument(p);return G.validateProject(p);
 }
 G.recipeProject=makeCombo;
 G.applyRecipe=function(project,id,options={}){
  if(!G.STUDIO_COMBOS.some(c=>c.id===id))return oldApplyRecipe(project,id,options);
  const {bar=0,key=project.key,seed=1,tempo=false,ending=false}=options,recipe=makeCombo(id,{key,seed,ending});
  if(!Number.isInteger(bar)||bar<0||bar+recipe.bars>G.LIMITS.bars)throw Error('组合超出256小节范围。');
  if(project.tracks.length+recipe.tracks.length>G.LIMITS.tracks)throw Error('这套组合需要五条轨道，空间不足。');
  const p=G.clone(project);p.bars=Math.max(p.bars,bar+recipe.bars);for(const t of recipe.tracks){for(const clip of t.clips)clip.bar+=bar;p.tracks.push(t);}
  if(tempo){p.bpm=recipe.bpm;p.swing=recipe.swing;}G.pinDocument(p);const target=recipe.tracks.at(-1);
  return {project:G.validateProject(p),trackId:target.id,patternId:target.patterns[0].id,clipId:target.clips[0].id,trackIds:recipe.tracks.map(t=>t.id),range:[bar*G.BAR,(bar+8)*G.BAR]};
 };
 G.studioFamilies=function(project,{kind='all',legacy=false,role='all',query=''}={}){
  const q=query.toLowerCase().trim(),fams=[...familyById.values()].map(f=>({...G.clone(f),members:[...f.members,...(legacy?f.legacyMembers||[]:[])]}));
  if(legacy){
   const assigned=new Set(fams.flatMap(f=>f.members));
   for(const t of G.catalogTemplates())if(!assigned.has(t.id)){
    const role=t.role||(t.kind==='drum'?'drums':'melody'),id='legacy.'+(t.type==='song'?'song':role+'.'+t.bars+'.'+t.key+'.'+t.scale);
    let f=fams.find(x=>x.id===id);if(!f){f={id,name:t.type==='song'?'原有示例作品':({drums:'原有鼓点',chords:'原有和弦',bass:'原有贝斯',melody:'原有旋律',texture:'原有伴奏'})[role]+' · '+t.bars+'小节',kind:t.type==='song'?'example':'rhythm',role,description:'旧内容保持原ID，按角色与长度归组。',members:[],defaultId:t.id,legacy:true};fams.push(f);}f.members.push(t.id);
   }
   for(const p of G.projectPresets(project))if(!assigned.has(p.id)){
    fams.push({id:'imported.'+p.id,name:p.name,kind:'sound',role:p.engine==='drum'?'drums':p.category==='低音'?'bass':'melody',members:[p.id],defaultId:p.id,description:p.description,legacy:true});
   }
  }
  return fams.filter(f=>(kind==='all'||f.kind===kind)&&(role==='all'||f.role===role)&&(!q||[f.name,f.description,...(f.tags||[]),...f.members.map(id=>{try{return f.kind==='sound'?G.resolvePreset(id,project).name:G.getTemplate(id).name;}catch{return id;}})].join(' ').toLowerCase().includes(q)));
 };
 G.studioItem=function(id,project){if(G.PROGRESSIONS.some(p=>p.id+'.generated'===id))return G.generateProgression(id.slice(0,-10),{key:project?.key||0}).template;const combo=G.STUDIO_COMBOS.find(c=>c.id===id);if(combo)return {...G.clone(combo),type:'recipe',role:'song'};const sound=G.resolvePreset(id,project);if(!sound.missing)return {...G.clone(sound),type:'sound',role:sound.engine==='drum'?'drums':sound.category==='低音'?'bass':'melody'};try{return G.getTemplate(id);}catch{return null;}};
 G.studioFamilyOf=id=>[...familyById.values()].find(f=>f.members.includes(id)||f.legacyMembers?.includes(id))||null;
 G.studioDefaults=()=>['studio.combo.warm','studio.rhythm.four.1','studio.rhythm.hand-soul.1','studio.part.answer.1','prism.chords.pop','studio.combo.air'].filter(id=>G.studioItem(id,G.blankProject()));
 G.applyStudioSound=function(project,trackId,presetId){
  const p=G.clone(project),t=p.tracks.find(t=>t.id===trackId),preset=G.resolvePreset(presetId,p);
  if(!t||preset.missing)throw Error('目标音轨或声音已不存在。');
  if((t.kind==='drum')!==(preset.engine==='drum'))throw Error('选择同类型声音。');
  G.pinPreset(p,presetId);
  if(t.kind==='drum'){
   const rows=G.drumsFor(p,t),kitId=preset.drumkitId||(presetId.startsWith('studio.drum.')?'studio.kit.'+presetId.split('.').at(-1):'builtin.standard');
   G.pinKit(p,kitId);const kit=G.resolveKit(kitId,p);
   if((t.drumkitId||'builtin.standard')!==kitId)for(const pat of t.patterns)pat.notes=G.remapDrums(pat.notes,rows,kit.rows);
   t.drumkitId=kitId;
  }t.preset=presetId;return G.validateProject(p);
 };
 G.studioCanReuseTrack=function(project,item,target){
  if(!target||target.kind!==item.kind)return false;
  if(item.kind!=='drum'||(target.drumkitId||'builtin.standard')===(item.drumkitId||'builtin.standard'))return true;
  try{G.remapDrums(item.notes,G.resolveKit(item.drumkitId,project).rows,G.drumsFor(project,target));return true;}catch{return false;}
 };
 G.annotateStudioMaterial=function(pattern,id){
  // Stable template references survive edits and provide an exact ‘used’ collection.
  pattern.materialIds=[...new Set([...(pattern.materialIds||[]),id])];
  const s=G.STUDIO_SOURCES[id];if(!s)return;
  const ref={id,license:s.license||'MIT',credit:s.credit||'GridTone contributors',...(s.sourceFile?{sourceFile:s.sourceFile,sourceBars:s.sourceBars,sha256:s.sha256}:{}),description:s.source||s.dataset||'Music material'};
  pattern.attributions??=[];if(!pattern.attributions.some(r=>r.id===id))pattern.attributions.push(G.clone(ref));
 };
 G.STUDIO_LIBRARY_VERSION=1;
})(globalThis.GridTone ||= {});
