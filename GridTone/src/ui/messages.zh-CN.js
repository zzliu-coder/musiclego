/** Product language. Object identities, user-authored names and file schemas never pass through this map. */
(function(G){'use strict';
 G.ui ||= {};
 G.ui.words=Object.freeze({brand:'乐构',project:'作品',clip:'音乐块',template:'单块模板',recipe:'组合模板',song:'示例作品',candidate:'方案',draft:'草稿',preview:'试听',commit:'用这版'});
 G.ui.operationLabels=Object.freeze({generate:'写一句旋律',rhythm:'保留节奏，换音高',anchors:'保留关键音，改连接',ending:'改个结尾',answer:'写一个回答',drums:'变一段鼓点',bass:'写一条贝斯',accompaniment:'做一段伴奏',recipe:'放入组合模板',arrange:'发展编排',mix:'调整混音平衡',ensemble:'一起变化'});
 G.ui.qualityLabels=Object.freeze({major:'大三和弦',minor:'小三和弦',maj7:'大七和弦',min7:'小七和弦',dom7:'属七和弦',sus2:'挂二和弦',sus4:'挂四和弦',fifth:'五度和弦',dim:'减三和弦',halfDim:'半减七和弦',add9:'加九和弦'});
 G.ui.roles=Object.freeze({melody:{label:'旋律',icon:'melody',color:'#476bb4'},chords:{label:'和弦',icon:'chord',color:'#a16b32'},drums:{label:'鼓点',icon:'drum',color:'#bc5868'},bass:{label:'贝斯',icon:'bass',color:'#367f68'},texture:{label:'伴奏',icon:'wave',color:'#8770aa'},song:{label:'组合',icon:'arrange',color:'#62738b'},unspecified:{label:'音乐',icon:'notes',color:'#62738b'}});
 G.ui.fieldLabels=Object.freeze({mode:'这次做什么',sourceTrackId:'跟随哪段和弦',referenceTrackId:'配合声部',low:'最低音',high:'最高音',density:'音符多少',recipeId:'组合模板',strategy:'配合方式',rhythmTemplateId:'节奏起点',intent:'句尾走向',color:'连接方式',drumRole:'变化鼓件',drumStyle:'基础节奏',velocityStyle:'力度倾向',textureStyle:'弹奏方式',bars:'音乐长度'});
})(globalThis.GridTone ||= {});
