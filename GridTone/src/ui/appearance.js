/** Workstation preferences: presentation only, never part of the musical document. */
(function(G){'use strict';
 const key='gridtone.appearance.v1';let prefs={skin:'crystal',transparency:'normal',motion:'normal'};
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(['crystal','pearl'].includes(saved.skin))prefs.skin=saved.skin;if(saved.transparency==='reduced')prefs.transparency='reduced';if(saved.motion==='reduced')prefs.motion='reduced';}catch{}
 function apply(){document.documentElement.dataset.skin=prefs.skin;document.documentElement.dataset.transparency=prefs.transparency;document.documentElement.dataset.motion=prefs.motion;}
 function set(update){if(update.skin&&['crystal','pearl'].includes(update.skin))prefs.skin=update.skin;if(update.transparency&&['normal','reduced'].includes(update.transparency))prefs.transparency=update.transparency;if(update.motion&&['normal','reduced'].includes(update.motion))prefs.motion=update.motion;apply();try{localStorage.setItem(key,JSON.stringify(prefs));}catch{}return {...prefs};}
 G.appearance={get:()=>({...prefs}),set};apply();
})(globalThis.GridTone ||= {});
