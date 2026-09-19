/** Classic Studio voices. All rendering uses the host audio clock and graph;
 * there is no second transport. Native nodes work in real-time and OfflineAudioContext.
 * The Juno-style normalized control curves below are adapted from AMY amy/juno.py
 * c645a0d58402fd450819617959826be1eca162aa (MIT, Brian Whitman and Daniel PW Ellis).
 * This is NOT the AMY C/WASM runtime nor a circuit-exact hardware emulation.
 */
(function(G){'use strict';
 const clamp=G.clamp;
 const curves=Object.freeze({
  attack:v=>(6+8*clamp(v,0,1)*127)/1000,
  decay:v=>(80*2**(.085*clamp(v,0,1)*127)-80)/1000,
  release:v=>(70*2**(.066*clamp(v,0,1)*127)-70)/1000,
  cutoff:v=>13*2**(.0938*clamp(v,0,1)*127),
  resonance:v=>.7*2**(4*clamp(v,0,1)),
  lfo:v=>.6*2**(.04*clamp(v,0,1)*127)-.1
 });
 const safeFreq=(ctx,f)=>clamp(f,12,ctx.sampleRate*.44);
 function adsr(param,at,gate,amp,a,d,s,r){
  a=Math.min(Math.max(.002,a),gate*.7);d=Math.min(Math.max(.002,d),Math.max(.002,gate-a));
  const peak=at+a,hold=Math.min(at+gate,peak+d),sustain=Math.max(.00001,amp*s);
  param.setValueAtTime(.00001,at);param.linearRampToValueAtTime(amp,peak);
  param.exponentialRampToValueAtTime(sustain,hold);param.setValueAtTime(sustain,at+gate);
  param.exponentialRampToValueAtTime(.00001,at+gate+r);
 }
 function body(args){
  const {graph,out,note,track,preset,at,duration}=args,v=G.voiceTools(graph,out),p=preset.synthesis;
  if(!p)throw Error('此声音缺少发声定义。');
  const gate=Math.max(.018,duration),release=clamp(p.release*(track.sound.release/.32),.025,2.7);
  const end=at+gate+release+.02,amp=(preset.gain??1)*.18*Math.pow(clamp(note.velocity,.01,1),p.velocityCurve||1.2);
  const env=v.gain(0);env.connect(out);
  adsr(env.gain,at,gate,amp,p.attack*clamp(track.sound.attack/.01,.3,12),p.decay,p.sustain,release);
  return {v,p,gate,release,end,amp,env,freq:440*2**((note.pitch-69)/12)};
 }
 function widthStage(b,args){
  const {v,p,end,env}=b,{at}=args;if(!p.chorus)return env;
  const input=v.gain(1),dry=v.gain(.76);input.connect(dry);dry.connect(env);
  for(const sign of [-1,1]){
   const delay=v.add(v.ctx.createDelay(.1)),wet=v.gain(.19),pan=v.add(v.ctx.createStereoPanner());
   delay.delayTime.value=.012+(sign+1)*.0015;pan.pan.value=sign*.82;
   input.connect(delay);delay.connect(wet);wet.connect(pan);pan.connect(env);
   const lfo=v.add(v.ctx.createOscillator()),depth=v.gain(.0017*p.chorus);
   lfo.frequency.value=.47+(sign+1)*.08;lfo.connect(depth);depth.connect(delay.delayTime);v.source(lfo,at,end);
  }
  return input;
 }
 function graphState(b,args){
  if(!b.p.mono)return;b.beforeSources=new Set(args.graph.sources);args.graph.studioMono??=new Map();
  const prior=args.graph.studioMono.get(args.track.id);
  if(prior&&args.at<prior.until){b.glideFrom=prior.freq;for(const source of prior.sources){try{source.stop(args.at+.004);}catch{}}}
 }
 function classicVA(args){
  const b=body(args),{v,p,gate,end,freq}=b,{at,note,track}=args,filter=v.add(v.ctx.createBiquadFilter());
  graphState(b,args);const output=widthStage(b,args);filter.type='lowpass';filter.Q.value=clamp(curves.resonance(p.resonance),.55,10);filter.connect(output);
  const base=safeFreq(v.ctx,curves.cutoff(p.cutoff)*2**((track.sound.brightness-.55)*3)*(freq/261.6256)**p.keytrack);
  const lift=2**(p.envAmount*(.45+.55*note.velocity));filter.frequency.setValueAtTime(base,at);
  filter.frequency.exponentialRampToValueAtTime(safeFreq(v.ctx,base*lift),at+Math.min(.015,gate*.2));
  filter.frequency.exponentialRampToValueAtTime(base,at+Math.min(gate,Math.max(.04,p.filterDecay)));
  const waves=[p.wave1||'sawtooth',p.wave2||'square'];
  for(let i=0;i<2;i++){
   const osc=v.add(v.ctx.createOscillator()),gain=v.gain((i?p.mix:1-p.mix)*.66);osc.type=waves[i];
   osc.frequency.setValueAtTime((b.glideFrom||freq)*2**((i?p.octave2:0)),at);if(b.glideFrom)osc.frequency.exponentialRampToValueAtTime(freq*2**((i?p.octave2:0)),at+p.glide);osc.detune.value=(i?1:-1)*p.detune;
   osc.connect(gain);gain.connect(filter);v.source(osc,at,end);
   if(p.vibrato>0){const lfo=v.add(v.ctx.createOscillator()),depth=v.gain(p.vibrato);lfo.frequency.value=p.lfoRate;lfo.connect(depth);depth.connect(osc.detune);v.source(lfo,at,end);}
  }
  if(p.sub>0)v.osc('sine',freq/2,filter,at,end,p.sub*.55);
  if(p.noise>0){const src=v.add(v.ctx.createBufferSource()),gain=v.gain(p.noise*.09);src.buffer=G.seededNoise(v.ctx);src.loop=true;src.connect(gain);gain.connect(filter);v.source(src,at,end);}
  if(p.motion>0){const lfo=v.add(v.ctx.createOscillator()),depth=v.gain(Math.min(base*.7,1200)*p.motion);lfo.frequency.value=p.lfoRate;lfo.connect(depth);depth.connect(filter.frequency);v.source(lfo,at,end);}
  if(p.mono)args.graph.studioMono.set(args.track.id,{freq,until:at+gate,sources:[...args.graph.sources].filter(x=>!b.beforeSources.has(x))});
 }
 function classicFM(args){
  const b=body(args),{v,p,gate,end,freq,env}=b,{at,note,track}=args;
  const output=widthStage(b,args),filter=v.add(v.ctx.createBiquadFilter());filter.type='lowpass';filter.frequency.value=safeFreq(v.ctx,5500+track.sound.brightness*14000);filter.Q.value=.55;filter.connect(output);
  const ops=p.operators.map(o=>{const osc=v.add(v.ctx.createOscillator());osc.type='sine';osc.frequency.value=safeFreq(v.ctx,freq*o.ratio);osc.detune.value=o.detune||0;return osc;});
  const edges=p.algorithm===0?[[3,2],[2,1],[1,0]]:p.algorithm===1?[[1,0],[3,2]]:p.algorithm===2?[[1,0],[2,0],[3,0]]:[[3,2],[2,0],[1,0]];
  const carriers=p.algorithm===1?[0,2]:[0];
  for(const [from,to]of edges){const o=p.operators[from],depth=v.gain(0),level=freq*o.level*(.25+.75*note.velocity)*2**((track.sound.brightness-.55)*1.5);
   adsr(depth.gain,at,gate,Math.max(.001,level),Math.max(.002,p.attack*.35),o.decay,o.sustain||.05,b.release);ops[from].connect(depth);depth.connect(ops[to].frequency);
  }
  for(const i of carriers){const gain=v.gain(p.operators[i].level/(carriers.length*1.1));ops[i].connect(gain);gain.connect(filter);}
  for(const osc of ops)v.source(osc,at,end);
  if(p.vibrato){const lfo=v.add(v.ctx.createOscillator()),depth=v.gain(p.vibrato);lfo.frequency.value=p.lfoRate;for(const osc of ops)depth.connect(osc.detune);lfo.connect(depth);v.source(lfo,at,end);}
 }
 function studioDrum(args){
  const {graph,out,note,at,preset}=args,v=G.voiceTools(graph,out),p=preset.synthesis,vel=note.velocity*(preset.gain??1);
  const tone=(f,time,level,bend=1,wave='sine')=>{const g=v.gain(0);g.connect(out);g.gain.setValueAtTime(.00001,at);g.gain.linearRampToValueAtTime(vel*level,at+.002);g.gain.exponentialRampToValueAtTime(.00001,at+time);
   const o=v.osc(wave,f,g,at,at+time+.012);o.frequency.exponentialRampToValueAtTime(Math.max(15,bend),at+Math.min(time*.65,.16));};
  const noise=(time,hz,level,clap=false)=>{const src=v.add(v.ctx.createBufferSource()),f=v.add(v.ctx.createBiquadFilter()),g=v.gain(0);src.buffer=G.seededNoise(v.ctx);src.loop=true;f.type='highpass';f.frequency.value=safeFreq(v.ctx,hz);src.connect(f);f.connect(g);g.connect(out);
   g.gain.setValueAtTime(Math.max(.00001,vel*level),at);if(clap)for(const d of [.012,.024,.038]){g.gain.setValueAtTime(Math.max(.00001,vel*level*.13),at+d-.004);g.gain.setValueAtTime(Math.max(.00001,vel*level),at+d);}
   g.gain.exponentialRampToValueAtTime(.00001,at+time);return v.source(src,at,at+time+.01);};
  const pitch=note.pitch;
  if(pitch===36){tone(p.kickPitch*3,p.kickDecay,.83,p.kickPitch);noise(.014,2600,p.click);}
  else if(pitch===38){tone(p.snarePitch,.1,.2,p.snarePitch*.64);noise(p.snareDecay,p.snareHigh,.42);}
  else if(pitch===39)noise(p.snareDecay,1000,.41,true);
  else if(pitch===42||pitch===46){
   const time=pitch===42?p.hatDecay:p.hatDecay*7.2;
   graph.studioHats??=new Map();if(pitch===42){for(const source of graph.studioHats.get(args.track.id)||[]){try{source.stop(at+.003);}catch{}}graph.studioHats.delete(args.track.id);}
   const before=new Set(graph.sources);noise(time,p.hatHigh,.18);
   if(p.metal)for(const f of [2460,3340,4710]){const gain=v.gain(0);gain.connect(out);gain.gain.setValueAtTime(.018*vel,at);gain.gain.exponentialRampToValueAtTime(.00001,at+time);v.osc('square',safeFreq(v.ctx,f*p.metal),gain,at,at+time+.01);}
   if(pitch===46)graph.studioHats.set(args.track.id,[...graph.sources].filter(s=>!before.has(s)));
  }else if(pitch===45)tone(170,.29,.5,70);
  else if(pitch===49)noise(.85,p.hatHigh*.65,.3);
  else{tone(p.snarePitch*4,.027,.26,p.snarePitch*2.5,'triangle');noise(.02,2400,.11);}
 }
 const originalDrum=G.getInstrumentRenderer('drum');
 G.registerInstrument('studio-va',classicVA);G.registerInstrument('studio-fm4',classicFM);
 G.registerInstrument('drum',args=>args.preset.synthesis?.type==='electronic-kit'?studioDrum(args):originalDrum(args));
 G.StudioCurves=curves;
})(globalThis.GridTone ||= {});
