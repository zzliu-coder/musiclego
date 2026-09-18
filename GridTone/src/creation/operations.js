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
  ['ensemble','声部一起变化','group',[],['harmony'],[...notes,'sourceBar']]
 ].map(([id,label,scope,roles,requiredInputs,parameters])=>[id,{id,label,scope,roles,requiredInputs,parameters,random:!['mix','arrange'].includes(id)}]));
})(globalThis.GridTone ||= {});
