/** Accessible musical surfaces. Rendering only: never writes a track color into a document. */
(function(G){'use strict';
 G.ui ||= {};
 const roles={
  drums:{surface:'#fce0e5',ink:'#833d51'}, bass:{surface:'#dcebff',ink:'#2c5587'},
  chords:{surface:'#ffe9cc',ink:'#815019'}, melody:{surface:'#ddf2e8',ink:'#28664c'},
  texture:{surface:'#ece3fa',ink:'#624c89'}, song:{surface:'#eef0f6',ink:'#45566e'},
  unspecified:{surface:'#ddf1f2',ink:'#2e666b'}
 };
 const cache=new Map();
 const parse=c=>{const m=/^#([0-9a-f]{6})$/i.exec(c||'');if(!m)return null;const v=parseInt(m[1],16);return [v>>16,(v>>8)&255,v&255];};
 const hex=c=>'#'+c.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
 const blend=(a,b,f)=>a.map((x,i)=>x*(1-f)+b[i]*f);
 const luminance=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{const x=luminance(parse(a)),y=luminance(parse(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 function palette(color,role='unspecified'){
  const k=String(color||'')+':'+role;if(cache.has(k))return cache.get(k);
  const raw=parse(color);let p;
  if(!raw)p={...(roles[role]||roles.unspecified)};
  else {
   const surface=hex(blend([255,255,255],raw,.22));
   let ink=hex(blend(raw,[30,37,48],.48));
   for(let weight=.52;contrast(ink,surface)<5.5&&weight<=1;weight+=.04)ink=hex(blend(raw,[30,37,48],Math.min(1,weight)));
   p={surface,ink};
  }
  let border=p.ink;
  for(let f=.03;f<.8;f+=.03){const c=hex(blend(parse(p.ink),parse(p.surface),f));if(contrast(c,p.surface)<3.15)break;border=c;}
  p=Object.freeze({...p,border,noteSurface:raw?hex(blend([255,255,255],raw,.30)):p.surface,sourceColor:color||null});
  if(cache.size>512)cache.clear();cache.set(k,p);return p;
 }
 function css(color,role){const p=palette(color,role);return `--music-surface:${p.surface};--music-ink:${p.ink};--music-edge:${p.border};--block-color:${p.ink};--music-note:${p.noteSurface}`;}
 Object.assign(G.ui,{musicPalette:palette,musicStyle:css,musicRoles:Object.freeze(roles),colorContrast:contrast});
})(globalThis.GridTone ||= {});
