(function(G){'use strict';
 const notes=['start','end','low','high','density'];
 G.CREATION_OPERATIONS=Object.fromEntries([
  ['generate','生成一句','instance',['melody'],['harmony'],[...notes,'rhythmTemplateId','intent','color']],
  ['rhythm','保留节奏换音高','instance',['melody'],['harmony'],['start','end','low','high','color']],
  ['anchors','保留关键音改连接','instance',['melody'],['harmony'],['start','end','low','high','color']],
  ['ending','只改结尾','instance',['melody'],['harmony'],[...notes,'rhythmTemplateId','intent','color']],
  ['answer','回答句','instance',['melody'],['harmony'],['start','end','low','high','color']],
  ['drums','鼓型变化','instance',['drums'],[],['start','end','drumRole','lastBeat','density','drumStyle','velocityStyle']],
  ['bass','生成贝斯','instance',['bass'],['harmony'],[...notes,'referenceTrackId','strategy']],
  ['accompaniment','生成伴奏','instance',['texture','chords'],['harmony'],[...notes,'referenceTrackId','strategy','textureStyle']],
  ['recipe','配套模板','project',[],[],['recipeId','bar','tempo']],
  ['arrange','发展编排','project',[],[],['bar','sourceBar','bars','strategy']],
  ['mix','建议混音','project',[],[],[]],
  ['ensemble','声部一起变化','group',[],['harmony'],['sourceBar','bars','density','drumRole','drumStyle','velocityStyle','textureStyle']]
 ].map(([id,label,scope,roles,requiredInputs,parameters])=>[id,{id,label,scope,roles,requiredInputs,parameters,random:!['mix','arrange'].includes(id)}]));
 /** The same whitelist controls forms, calculation and candidate dependencies. */
 G.creationParameters=function(mode,values={}){
  const op=G.CREATION_OPERATIONS[mode];if(!op)throw Error('创作操作不存在。');
  const keys=[...op.parameters,...(op.requiredInputs.includes('harmony')?['sourceTrackId']:[]),...(op.random?['seed']:[])];
  if(mode==='ensemble')keys.push('trackIds','melodyTrackId');
  if(mode==='arrange')keys.push('clipIds','trackIds');
  const result={mode};for(const key of keys)if(values[key]!==undefined)result[key]=G.clone(values[key]);
  if(op.parameters.includes('rhythmTemplateId')&&values.rhythmTemplate)result.rhythmTemplate=G.clone(values.rhythmTemplate);
  return result;
 };
 G.creationDefaults=function(mode,track,pattern,project){
  const bass=mode==='bass';return G.creationParameters(mode,{start:0,end:Math.min(pattern.bars,8)*G.BAR,
   low:bass?36:60,high:bass?55:84,density:'normal',seed:42,sourceTrackId:'',referenceTrackId:'',
   rhythmTemplateId:'',color:'none',intent:'loop',lastBeat:false,drumRole:'closedHat',drumStyle:'straight',
   velocityStyle:'balanced',textureStyle:'sustain',strategy:mode==='arrange'?'variation':bass?'align':'support',
   sourceBar:0,bar:mode==='arrange'?project.bars:0,bars:mode==='ensemble'?pattern.bars:8,
   recipeId:G.RECIPES[0].id,tempo:false});
 };
 G.creationEffectiveInputs=function(project,operationId,parameters={}){
  const op=G.CREATION_OPERATIONS[operationId],inputs={};
  if(op?.parameters.includes('color')&&parameters.color==='diatonic')Object.assign(inputs,{key:project.key,scale:project.scale});
  if(op?.parameters.includes('rhythmTemplateId')&&parameters.rhythmTemplateId)inputs.rhythm=G.resolveRhythmTemplate(parameters.rhythmTemplateId);
  if(operationId==='recipe'){inputs.key=project.key;inputs.recipe=G.RECIPES.find(r=>r.id===parameters.recipeId)||null;}
  if(operationId==='catalog'&&parameters.adapt&&parameters.adapt!=='original'){inputs.key=project.key;if(parameters.adapt==='adapt')inputs.scale=project.scale;}
  return inputs;
 };
})(globalThis.GridTone ||= {});
