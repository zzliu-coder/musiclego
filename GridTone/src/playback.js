/** One listening owner. Every asynchronous completion belongs to one transport request. */
(function(G){
 'use strict';
 class PlaybackController{
  constructor(engine,getProject,getSession,context,onChange=()=>{},onError=()=>{}){
   Object.assign(this,{engine,getProject,getSession,context,onChange,onError});
   this.auditionProject=null;this.auditionScope=null;this.returnState=null;this.stopCount=0;this.request=0;
  }
  scope(){return this.auditionProject?this.auditionScope:G.scopeFor(this.getProject(),this.getSession(),this.context);}
  position(){return this.engine.position()+(this.scope()?.range?.[0]||0);}
  async start(target=this.context.target,start=this.context.startTick||0){
   this.endAudition(false);const request=++this.request;this.context.target=target;this.stopCount=0;
   try{
    const scope=this.scope();G.resolvePlaybackScope(this.getProject(),scope);
    await this.engine.play(this.getProject(),scope,this.context.loop,Math.max(0,start-(scope.range?.[0]||0)));
   }catch(e){if(request!==this.request)return false;this.engine.stop();this.onError(e.message);}
   if(request!==this.request)return false;this.onChange();return this.engine.playing;
  }
  async toggle(){
   if(this.engine.playing||this.engine.starting){this.request++;this.engine.pause();this.onChange();return;}
   if(this.auditionProject){
    const request=++this.request,p=this.auditionProject;
    try{await this.engine.play(p,this.auditionScope,this.context.loop,this.engine.pausedAt);}
    catch(e){if(request!==this.request)return false;this.endAudition();this.onError(e.message);return false;}
    if(request!==this.request)return false;this.onChange();return this.engine.playing&&this.auditionProject===p;
   }
   return this.start(this.context.target,this.engine.pausedAt+(this.scope()?.range?.[0]||0));
  }
  endAudition(restore=true){
   if(!this.auditionProject)return;
   const request=++this.request,saved=this.returnState;
   this.returnState=null;this.engine.stop();this.auditionProject=null;this.auditionScope=null;delete this.context.audition;
   if(restore&&saved){
    Object.assign(this.context,saved.context);this.engine.pausedAt=saved.tick;
    if(saved.playing)this.engine.play(this.getProject(),this.scope(),this.context.loop,saved.tick).catch(e=>{if(request===this.request)this.onError(e.message);});
   }
   this.onChange();
  }
  stop(){
   this.endAudition(false);this.request++;this.engine.stop();this.stopCount++;
   this.engine.pausedAt=this.stopCount>1?0:Math.max(0,(this.context.startTick||0)-(this.scope()?.range?.[0]||0));
   if(this.stopCount>1){this.context.startTick=0;this.context.range=null;}this.onChange();
  }
  seek(tick){
   this.endAudition(false);this.request++;this.stopCount=0;
   const scope=this.scope(),lo=scope.range?.[0]||0,hi=scope.range?.[1]||G.resolvePlaybackScope(this.getProject(),scope).length;
   tick=G.clamp(tick,lo,hi-1);this.context.startTick=tick;
   if(this.engine.starting)void this.start(this.context.target,tick);else this.engine.seek(tick-lo);
   this.onChange();
  }
  setRange(range){
   if(range&&(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]<0||range[1]<=range[0]||range[1]>this.getProject().bars*G.BAR))throw Error('循环范围超出作品。');
   const active=this.engine.playing||this.engine.starting;
   this.endAudition(false);this.request++;this.context.range=range?G.clone(range):null;this.context.target='song';
   const tick=range?range[0]:0;this.context.startTick=tick;
   if(active)void this.start('song',tick);else{this.engine.stop();this.engine.pausedAt=0;this.onChange();}
  }
  setTarget(target){
   const active=this.engine.playing||this.engine.starting;this.endAudition(false);this.request++;
   this.context.target=target;this.context.startTick=0;this.context.range=null;
   if(active)void this.start(target,0);else{this.engine.stop();this.onChange();}
  }
  editorChanged(){if(this.auditionProject)return;if(['pattern','bar'].includes(this.context.target)){if(this.engine.playing||this.engine.starting)void this.start(this.context.target,0);else{this.request++;this.engine.stop();}}}
  leaveEditor(){if(this.auditionProject)this.endAudition();if(['pattern','bar'].includes(this.context.target))this.setTarget('song');}
  updateProject(){
   if(this.auditionProject)this.endAudition(false);this.request++;
   if(this.engine.starting){void this.start();return;}
   try{this.engine.update(this.getProject(),this.scope());}catch(e){this.engine.stop();this.onError(e.message);}
  }
  updateMix(){
   if(this.auditionProject)this.endAudition(false);
   try{this.engine.updateMix(this.getProject(),this.scope());}catch(e){this.onError(e.message);}this.onChange();
  }
  toggleSolo(id){const b=this.context;b.soloIds=b.soloIds.includes(id)?b.soloIds.filter(x=>x!==id):[...b.soloIds,id];this.updateMix();}
  restoreSong(){this.endAudition();this.context.soloIds=[];if(this.context.target!=='song'||this.context.range)this.setTarget('song');this.updateMix();}
  async audition(p,scope,label){
   const request=++this.request;
   if(!this.auditionProject)this.returnState={context:G.clone(this.context),tick:this.engine.position(),playing:this.engine.playing||this.engine.starting};
   this.engine.stop();this.auditionProject=p;this.auditionScope=G.clone(scope);this.context.audition=label;
   try{await this.engine.play(p,this.auditionScope,this.context.loop,0);}
   catch(e){if(request!==this.request)return false;this.endAudition();this.onError(e.message);return false;}
   if(request!==this.request)return false;this.onChange();return this.engine.playing&&this.auditionProject===p;
  }
  /** A snapshot pairs the document with its scope; scope alone cannot represent a draft. */
  exportSelection(range='song'){
   if(!['song','pattern','current'].includes(range))throw Error('导出范围无效。');
   if(range==='current'&&this.auditionProject)return {project:G.clone(this.auditionProject),scope:G.clone(this.auditionScope),label:this.context.audition||'当前预听'};
   const project=G.clone(this.getProject()),session=this.getSession();
   const scope=range==='pattern'?{kind:'pattern',trackId:session.trackId,patternId:session.patternId,ignoreMute:true}:range==='current'?G.scopeFor(project,session,this.context):{kind:'song',soloIds:[]};
   return {project,scope,label:G.playbackLabel(project,session,this.context)};
  }
  exportScope(range='song'){return this.exportSelection(range).scope;}
 }
 G.PlaybackController=PlaybackController;
})(globalThis.GridTone ||= {});
