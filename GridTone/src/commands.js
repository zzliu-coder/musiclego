/** Atomic command boundary. Session gestures commit once through markChanged. */
(function(G){'use strict';
 function executeCommand(document,command,target={},payload={}){
  try{
   const draft=G.cloneProject(document);
   let next=draft;
   if(typeof command==='function')next=command(draft)||draft;
   else if(command==='duplicate-track')next=G.duplicateTrack(draft,target.trackId).project;
   else if(command==='replace-document')next=payload.document;
   else throw Object.assign(Error('命令不存在。'),{code:'UNKNOWN_COMMAND'});
   next=G.validateProject(next);
   return {ok:true,document:next,affectedIds:[target.trackId,target.patternId,target.clipId].filter(Boolean),changeKinds:['music'],changed:!G.projectEquals(document,next)};
  }catch(error){return {ok:false,error:{code:error.code||'INVALID_COMMAND',message:error.message},document};}
 }
 G.executeCommand=executeCommand;
})(globalThis.GridTone ||= {});
