/** Bounded, data-only definitions: user libraries cannot inject code or AudioNodes. */
(function(G){'use strict';
 const valid=(v,a,b,name)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error('声音参数无效：'+name);return v;};
 const wave=v=>{if(!['sine','square','triangle','sawtooth'].includes(v))throw Error('声音波形无效。');return v;};
 G.validateStudioSynthesis=function(input,engine){
  if(!input||typeof input!=='object'||input.version!==1)throw Error('发声定义版本无效。');
  const p=G.clone(input),out={version:1,type:p.type};
  if(engine==='studio-wave'){
   if(p.type!==engine)throw Error('波形引擎定义不一致。');
   if(!Array.isArray(p.real)||!Array.isArray(p.imag)||p.real.length!==p.imag.length||p.real.length<2||p.real.length>65)throw Error('波形需要 1–64 个泛音。');
   out.real=p.real.map(x=>valid(x,-2,2,'real'));out.imag=p.imag.map(x=>valid(x,-2,2,'imag'));
   if(out.real[0]!==0||out.imag[0]!==0||!out.real.slice(1).some(x=>x!==0)&&!out.imag.slice(1).some(x=>x!==0))throw Error('波形必须无直流且包含有效泛音。');
   for(const [k,a,b]of [['attack',.002,2],['decay',.005,5],['sustain',.01,1],['release',.025,3],['cutoff',80,16000]])out[k]=valid(p[k],a,b,k);
   return out;
  }
  if(p.type==='electronic-kit'){
   if(engine!=='drum')throw Error('鼓组需要鼓声引擎。');
   for(const [k,a,b]of [['kickPitch',25,100],['kickDecay',.08,1.2],['click',0,.25],['snarePitch',90,350],['snareDecay',.04,.7],['snareHigh',200,6000],['hatDecay',.02,.2],['hatHigh',2000,14000],['metal',0,2]])out[k]=valid(p[k],a,b,k);return out;
  }
  if(!['studio-va','studio-fm4'].includes(engine)||p.type!==engine)throw Error('发声定义与引擎不一致。');
  for(const [k,a,b]of [['attack',.002,2],['decay',.005,5],['sustain',.01,1],['release',.025,3],['velocityCurve',.5,3],['chorus',0,1],['vibrato',0,60],['lfoRate',.03,16]])out[k]=valid(p[k],a,b,k);
  if(engine==='studio-va'){
   for(const [k,a,b]of [['mix',0,1],['detune',0,45],['octave2',-1,1],['sub',0,1],['noise',0,1],['cutoff',0,1],['resonance',0,1],['envAmount',0,7],['filterDecay',.01,5],['keytrack',0,1.5],['motion',0,1],['glide',0,.5]])out[k]=valid(p[k],a,b,k);
   out.wave1=wave(p.wave1);out.wave2=wave(p.wave2);if(typeof p.mono!=='boolean')throw Error('单音模式无效。');out.mono=p.mono;
  }else{
   out.algorithm=valid(p.algorithm,0,3,'algorithm');if(!Number.isInteger(out.algorithm))throw Error('FM算法需要整数。');
   if(!Array.isArray(p.operators)||p.operators.length!==4)throw Error('FM声音需要四个运算器。');
   out.operators=p.operators.map(o=>({ratio:valid(o.ratio,.25,16,'ratio'),level:valid(o.level,.01,10,'level'),decay:valid(o.decay,.005,5,'decay'),sustain:valid(o.sustain,.01,1,'sustain'),detune:valid(o.detune??0,-30,30,'detune')}));
  }return out;
 };
})(globalThis.GridTone ||= {});
