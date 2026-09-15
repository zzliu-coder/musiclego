/** One listening owner, with explicit audition return and an independent transport origin. */
(function(G){
 'use strict';
 class PlaybackController{
  constructor(engine,getProject,getSession,context,onChange=()=>{},onError=()=>{}){Object.assign(this,{engine,getProject,getSession,context,onChange,onError});this.auditionProject=null;this.auditionScope=null;this.returnState=null;this.stopCount=0;}
  scope(){return this.auditionProject?this.auditionScope:G.scopeFor(this.getProject(),this.getSession(),this.context);}
  position(){return this.engine.position()+(this.scope()?.range?.[0]||0);}
  async start(target=this.context.target,start=this.context.startTick||0){
   this.endAudition(false);this.context.target=target;this.stopCount=0;
   try{const scope=this.scope();G.resolvePlaybackScope(this.getProject(),scope);await this.engine.play(this.getProject(),scope,this.context.loop,Math.max(0,start-(scope.range?.[0]||0)));}catch(e){this.engine.stop();this.onError(e.message);}this.onChange();
  }
  async toggle(){
   if(this.engine.playing||this.engine.starting){this.engine.pause();this.onChange();return;}
   if(this.auditionProject){try{await this.engine.play(this.auditionProject,this.auditionScope,this.context.loop,this.engine.pausedAt);}catch(e){this.onError(e.message);}this.onChange();return;}
   return this.start(this.context.target,this.engine.pausedAt+(this.scope()?.range?.[0]||0));
  }
  endAudition(restore=true){
   if(!this.auditionProject)return;
   const saved=this.returnState;this.returnState=null;this.engine.stop();this.auditionProject=null;this.auditionScope=null;delete this.context.audition;
   if(restore&&saved){Object.assign(this.context,saved.context);this.engine.pausedAt=saved.tick;if(saved.playing)this.engine.play(this.getProject(),this.scope(),this.context.loop,saved.tick).catch(e=>this.onError(e.message));}
   this.onChange();
  }
  stop(){this.endAudition(false);this.engine.stop();this.stopCount++;this.engine.pausedAt=this.stopCount>1?0:Math.max(0,(this.context.startTick||0)-(this.scope()?.range?.[0]||0));if(this.stopCount>1){this.context.startTick=0;this.context.range=null;}this.onChange();}
  seek(tick){this.endAudition(false);this.stopCount=0;const scope=this.scope(),lo=scope.range?.[0]||0,hi=scope.range?.[1]||G.resolvePlaybackScope(this.getProject(),scope).length;tick=G.clamp(tick,lo,hi-1);this.context.startTick=tick;this.engine.seek(tick-lo);this.onChange();}
  setRange(range){const active=this.engine.playing;this.context.range=range;this.context.target='song';const tick=range?range[0]:0;this.context.startTick=tick;if(active)this.start('song',tick);else{this.engine.stop();this.engine.pausedAt=0;this.onChange();}}
  setTarget(target){const active=this.engine.playing;this.endAudition(false);this.context.target=target;this.context.startTick=0;this.context.range=null;if(active)this.start(target,0);else{this.engine.stop();this.onChange();}}
  editorChanged(){if(this.auditionProject)return;if(['pattern','bar'].includes(this.context.target)){if(this.engine.playing)this.start(this.context.target,0);else this.engine.stop();}}
  leaveEditor(){if(this.auditionProject)this.endAudition();if(['pattern','bar'].includes(this.context.target))this.setTarget('song');}
  updateProject(){if(this.auditionProject)this.endAudition(false);try{this.engine.update(this.getProject(),this.scope());}catch(e){this.engine.stop();this.onError(e.message);}}
  updateMix(){try{if(this.auditionProject)this.endAudition(false);this.engine.updateMix(this.getProject(),this.scope());}catch(e){this.onError(e.message);}this.onChange();}
  toggleSolo(id){const b=this.context;b.soloIds=b.soloIds.includes(id)?b.soloIds.filter(x=>x!==id):[...b.soloIds,id];this.updateMix();}
  restoreSong(){this.endAudition();this.context.soloIds=[];if(this.context.target!=='song'||this.context.range)this.setTarget('song');this.updateMix();}
  async audition(p,scope,label){if(!this.auditionProject)this.returnState={context:G.clone(this.context),tick:this.engine.position(),playing:this.engine.playing};this.engine.stop();this.auditionProject=p;this.auditionScope=scope;this.context.audition=label;try{await this.engine.play(p,scope,this.context.loop,0);}catch(e){this.endAudition();this.onError(e.message);}this.onChange();return this.engine.playing&&this.auditionProject===p;}
  exportScope(range='song'){if(range==='pattern')return {kind:'pattern',trackId:this.getSession().trackId,patternId:this.getSession().patternId,ignoreMute:true};if(range==='current')return G.scopeFor(this.getProject(),this.getSession(),this.context);return {kind:'song',soloIds:[]};}
 }
 G.PlaybackController=PlaybackController;
})(globalThis.GridTone ||= {});
