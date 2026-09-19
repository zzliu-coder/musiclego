/** Display coordinates are one-based; stored ticks and half-open intervals remain exact. */
(function(G){'use strict';G.ui ||= {};
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const decimal=n=>{const value=String(n);if(!/[eE]/.test(value))return value;const [base,power]=value.split(/[eE]/),[whole,fraction='']=base.split('.'),digits=whole+fraction,at=whole.length+Number(power);return at<=0?'0.'+'0'.repeat(-at)+digits:at>=digits.length?digits+'0'.repeat(at-digits.length):digits.slice(0,at)+'.'+digits.slice(at);};
 function position(tick){if(!finite(tick)||tick<0)throw Error('音乐位置无效。');const bar=Math.floor(tick/G.BAR),within=tick-bar*G.BAR,beat=Math.floor(within/G.PPQ),rest=within-beat*G.PPQ;return `${bar+1}.${beat+1}${rest?'+'+decimal(rest):''}`;}
 function parsePosition(text){const m=/^\s*(\d+)\.(\d+)(?:\+(\d+(?:\.\d+)?))?\s*$/.exec(String(text));if(!m)throw Error('位置请写成“小节.拍”，例如 2.3；精确位置可写 2.3+120。');const bar=Number(m[1]),beat=Number(m[2]),rest=Number(m[3]||0);if(!Number.isSafeInteger(bar)||bar<1||bar>G.LIMITS.bars+1||!Number.isFinite(rest)||beat<1||beat>4||rest<0||rest>=G.PPQ)throw Error('小节从 1 开始，每小节 4 拍；细分小于 960 ticks。');return (bar-1)*G.BAR+(beat-1)*G.PPQ+rest;}
 function positionLabel(tick){const str=position(tick),[a,b]=str.split('.');return `第 ${a} 小节 · 第 ${b.split('+')[0]} 拍${str.includes('+')?' + '+str.split('+')[1]+' ticks':''}`;}
 function range(start,end){if(!finite(start)||!finite(end)||start<0||end<=start)return '请选择有效范围';if(start%G.BAR===0&&end%G.BAR===0)return `第 ${start/G.BAR+1}${end/G.BAR===start/G.BAR+1?'':'—'+end/G.BAR} 小节`;return `${position(start)} — ${position(end)} · 终点不含`;}
 function pan(value){if(!finite(value))return '—';return Math.abs(value)<.005?'居中':(value<0?'左 ':'右 ')+Math.round(Math.abs(value)*100)+'%';}
 function percent(value){return finite(value)?Math.round(value*100)+'%':'—';}
 function parameter(group,key,value){if(key==='pan')return pan(value);if(key==='attack')return Math.round(value*1000)+' ms';if(key==='release')return value.toFixed(2)+' s';if(group==='pipeline')return key==='transpose'?(value>0?'+':'')+value+' 半音':decimal(value)+' ticks';return percent(value);}
 function quality(q){return G.ui.qualityLabels[q]||'自定义和弦';}
 function error(value){const text=String(value?.message??value??'');if(/^Failed to execute ['"](?:open|transaction)['"] on ['"](?:IDBFactory|IDBDatabase)['"]/.test(text)&&/denied|not allowed|permission/i.test(text))return '当前浏览器未允许本机存储。音乐内容保持在本页，请先下载作品文件备份；使用完整浏览器打开固定网址后再保存。';return text;}
 G.ui.format={error,position,parsePosition,positionLabel,range,pan,percent,parameter,quality};
})(globalThis.GridTone ||= {});
