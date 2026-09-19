/** Native host-clock rendering in both AudioContext and OfflineAudioContext.
 * AKWF Fourier coefficients are pinned inside each preset, never looked up by a mutable name. */
(function(G){'use strict';
 const cache=new WeakMap();
 G.registerInstrument('studio-wave',({graph,out,note,track,preset,at,duration})=>{
  const v=G.voiceTools(graph,out),p=preset.synthesis,ctx=graph.ctx;
  let waves=cache.get(ctx);if(!waves){waves=new Map();cache.set(ctx,waves);}
  const key=JSON.stringify([p.real,p.imag]);let wave=waves.get(key);
  if(!wave){wave=ctx.createPeriodicWave(new Float32Array(p.real),new Float32Array(p.imag));if(waves.size>=128)waves.clear();waves.set(key,wave);}
  const osc=v.add(ctx.createOscillator()),env=v.gain(0),filter=v.add(ctx.createBiquadFilter());
  osc.setPeriodicWave(wave);osc.frequency.value=440*2**((note.pitch-69)/12);
  filter.type='lowpass';filter.Q.value=.65;filter.frequency.value=Math.min(ctx.sampleRate*.44,p.cutoff*2**((track.sound.brightness-.55)*3));
  osc.connect(filter);filter.connect(env);env.connect(out);
  const gate=Math.max(.02,duration),attack=Math.min(gate*.7,p.attack*G.clamp(track.sound.attack/.01,.3,12)),decay=Math.min(p.decay,Math.max(.002,gate-attack)),release=G.clamp(p.release*track.sound.release/.32,.025,2.7),amp=.19*(preset.gain??1)*note.velocity**1.2;
  env.gain.setValueAtTime(.00001,at);env.gain.linearRampToValueAtTime(amp,at+attack);env.gain.exponentialRampToValueAtTime(Math.max(.00001,amp*p.sustain),at+attack+decay);env.gain.setValueAtTime(Math.max(.00001,amp*p.sustain),at+gate);env.gain.exponentialRampToValueAtTime(.00001,at+gate+release);
  v.source(osc,at,at+gate+release+.01);
 });
})(globalThis.GridTone ||= {});
