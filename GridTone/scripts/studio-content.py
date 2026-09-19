#!/usr/bin/env python3
"""Author/rebuild the data-only Studio library. Original presets; no factory patch dumps.
GMD excerpts are rebuilt separately by import-gmd.py. Stable IDs are never reused.
"""
from pathlib import Path
from copy import deepcopy as cp
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]; BAR=3840;STEP=240
presets=[];templates=[];families=[];lineages={}
VA=dict(version=1,type='studio-va',attack=.008,decay=.24,sustain=.58,release=.28,velocityCurve=1.3,chorus=0,vibrato=0,lfoRate=.4,wave1='sawtooth',wave2='square',mix=.4,detune=4,octave2=0,sub=.15,noise=0,cutoff=.62,resonance=.13,envAmount=1.6,filterDecay=.24,keytrack=.45,motion=0,glide=0,mono=False)
FM=dict(version=1,type='studio-fm4',attack=.004,decay=.5,sustain=.2,release=.45,velocityCurve=1.3,chorus=0,vibrato=0,lfoRate=4.7,algorithm=1,operators=[dict(ratio=r,level=l,decay=d,sustain=s,detune=0) for r,l,d,s in [(1,1,.6,.3),(1,2,.25,.06),(2,.45,.5,.2),(7,1.2,.08,.01)]])

def family(id,name,role,summary,items,kind='sound',tags=None):
    families.append(dict(id='family.'+id,name=name,kind=kind,role=role,description=summary,members=items,defaultId=items[0],tags=tags or [],status='curated-design'))

def preset(id,name,category,description,base,changes,gain=.8,tags=None):
    s=cp(base);s.update(changes);id='studio.'+id
    p=dict(id=id,version=1,name=name,category=category,description=description,engine=s['type'] if s['type']!='electronic-kit' else 'drum',wave='sine',ratio=1,index=1,release=s.get('release',.32),decay=.3,gain=gain,tags=tags or [],origin='乐构 Classic Studio · 原创预设；Web Audio 实时合成',synthesis=s)
    presets.append(p);lineages[id]=dict(license='MIT',source='Original GridTone preset',renderer=s['type'],curveAttribution='AMY MIT normalized Juno curves' if s['type']=='studio-va' else None)
    return id

a=preset('va.round','圆润低音','低音','正弦低层与柔和三角波；短音清楚，长音有稳固底部。',VA,dict(wave1='triangle',wave2='sine',mix=.22,sub=.5,cutoff=.53,envAmount=1.4,sustain=.72,chorus=0),.94,['圆润','短音'])
b=preset('va.pluckbass','弹簧低音','低音','快速滤波收合与短促尾音，适合切分节奏。',VA,dict(cutoff=.47,resonance=.28,envAmount=3.2,filterDecay=.12,decay=.12,sustain=.23,release=.09,sub=.4,detune=1),.96,['弹性','切分'])
family('analog-bass','模拟低音','bass','圆润承托或短促弹跳',[a,b],tags=['模拟','低音'])
a=preset('va.acid','酸性脉冲','低音','高共振滤波与鲜明起音，适合短促电子低音。',VA,dict(wave2='sawtooth',mix=.14,cutoff=.47,resonance=.76,envAmount=3.3,filterDecay=.17,decay=.16,sustain=.2,release=.1,sub=.2,detune=0),.67,['共振','锐利'])
b=preset('va.rubber','橡胶低音','低音','方波主体、收束较慢的滤波包络。',VA,dict(wave1='square',wave2='triangle',mix=.25,cutoff=.5,resonance=.43,envAmount=2.2,filterDecay=.29,decay=.25,sustain=.32,release=.12),.67,['方波','弹性'])
family('resonant-bass','共振低音','bass','带明显滤波性格的电子低音',[a,b])
a=preset('va.sawlead','双锯主音','主音','轻微失谐的双锯齿；清楚、集中、有推动感。',VA,dict(wave2='sawtooth',mix=.5,detune=7,cutoff=.83,envAmount=.6,sub=0,vibrato=4,lfoRate=5.1,release=.18),.59,['明亮','主音'])
b=preset('va.pulselead','方波独白','主音','方波与三角波混合，适合线条清楚的短旋律。',VA,dict(wave1='square',wave2='triangle',mix=.4,detune=1,cutoff=.71,envAmount=.6,sub=0,vibrato=6,lfoRate=5,release=.14),.65,['方波','旋律'])
c=preset('va.slidelead','连奏滑音','主音','单音连奏；重叠音之间平滑滑行，短音保持清楚。',VA,dict(wave1='square',wave2='sawtooth',mix=.35,detune=2,cutoff=.72,sub=0,envAmount=.5,glide=.08,mono=True,release=.12),.64,['连奏','滑音'])
family('analog-lead','复古主音','melody','锯齿、方波与单音滑行',[a,b,c])
a=preset('va.brass','暖铜和弦','键盘','轻微展开的滤波起音，适合合成铜管式和弦。',VA,dict(wave2='sawtooth',mix=.5,detune=5,cutoff=.58,envAmount=2.3,filterDecay=.36,attack=.032,decay=.38,sustain=.58,release=.23),.55,['铜管感','和弦'])
b=preset('va.stab','短促键帽','键盘','短包络与略空心的主体；适合反拍轻弹。',VA,dict(wave1='square',wave2='sawtooth',mix=.28,detune=2,cutoff=.61,envAmount=1.8,filterDecay=.12,decay=.09,sustain=.09,release=.07,sub=0),.7,['短促','反拍'])
family('synth-chords','合成和弦','chords','长短明确的两种和弦触感',[a,b])
a=preset('va.silk','丝绒合唱','氛围','缓慢起音、宽合唱与柔和滤波，承托旋律。',VA,dict(wave2='sawtooth',mix=.5,attack=.25,decay=.9,sustain=.82,release=1.25,chorus=.85,cutoff=.59,envAmount=.55,sub=.08,detune=9,motion=.16,lfoRate=.27),.56,['柔和','宽阔'])
b=preset('va.darkpad','夜幕音垫','氛围','较暗的持续和弦，低速明暗起伏。',VA,dict(wave1='triangle',wave2='sawtooth',mix=.34,attack=.43,decay=1.2,sustain=.88,release=1.6,chorus=.62,cutoff=.49,envAmount=.65,sub=.1,detune=12,motion=.32,lfoRate=.12),.7,['暗','缓慢'])
family('retro-pad','复古音垫','texture','柔光与暗色两种持续背景',[a,b])
a=preset('va.breath','空气流动','氛围','三角波、细噪声与缓慢滤波，适合留白段落。',VA,dict(wave1='triangle',wave2='sine',mix=.35,noise=.5,attack=.65,decay=.8,sustain=.77,release=1.4,chorus=.65,cutoff=.72,envAmount=.25,sub=0,detune=12,motion=.5,lfoRate=.16),.56,['空气','留白'])
b=preset('va.motion','弧光脉动','氛围','可持续的滤波律动；运动来自音色，不自动添加音符。',VA,dict(wave1='sawtooth',wave2='triangle',mix=.4,attack=.12,decay=.5,sustain=.86,release=.8,chorus=.65,cutoff=.65,envAmount=.1,sub=0,detune=9,motion=.88,lfoRate=2.4),.53,['运动','持续'])
family('motion-pad','流动音垫','texture','空气与滤波运动',[a,b])
a=preset('fm.tine','玻璃电钢','键盘','四运算器双载波，轻弹柔和、重弹带金属起音。',FM,dict(chorus=.48),.87,['FM','电钢'])
x=cp(FM['operators']);x[1].update(level=.9,decay=.32);x[3].update(ratio=3,level=.7,decay=.14)
b=preset('fm.softkeys','柔光电钢','键盘','降低高次调制，尾部更温和，适合七和弦。',FM,dict(operators=x,chorus=.32,release=.65,decay=.85,sustain=.21),.94,['柔和','电钢'])
family('fm-ep','FM电钢','chords','一组动态明确的电钢声音',[a,b])
x=cp(FM['operators']);x[1].update(ratio=1,level=3.8,decay=.085,sustain=.03);x[2].update(ratio=.5,level=.8);x[3].update(ratio=2,level=1,decay=.11)
a=preset('fm.slap','弹指FM低音','低音','强起音之后快速收敛，适合密度适中的切分。',FM,dict(operators=x,decay=.2,sustain=.3,release=.1,velocityCurve=1.65),1.06,['FM','弹指'])
x=cp(FM['operators']);x[1].update(ratio=2,level=1.7,decay=.24);x[2].update(ratio=.5,level=.52);x[3].update(ratio=1,level=.4)
b=preset('fm.woodbass','木芯数字低音','低音','较少金属感的空心低音，长短音都保持清楚。',FM,dict(operators=x,decay=.45,sustain=.38,release=.16),1.04,['空心','低音'])
family('fm-bass','FM低音','bass','弹指起音与木芯主体',[a,b])
x=cp(FM['operators']);x[1].update(ratio=3,level=2.8,decay=.055);x[2].update(ratio=2,level=.38);x[3].update(ratio=5,level=1.1,decay=.08)
a=preset('fm.koto','数字古筝','拨弦','尖细拨弦起音与短尾；适合分解旋律。',FM,dict(operators=x,decay=.36,sustain=.07,release=.2),.92,['拨弦','清脆'])
x=cp(FM['operators']);x[1].update(ratio=2,level=1.2,decay=.12);x[2].update(ratio=3,level=.25);x[3].update(ratio=1,level=.65,decay=.2)
b=preset('fm.harp','水滴拨弦','拨弦','圆润、通透，较少高频攻击。',FM,dict(operators=x,decay=.6,sustain=.06,release=.35,chorus=.25),.88,['水滴','轻巧'])
family('fm-pluck','数字拨弦','melody','清脆和圆润的两种拨弦',[a,b])
x=[dict(ratio=r,level=l,decay=d,sustain=.02,detune=0) for r,l,d in [(1,1,1.8),(2.71,2.7,.32),(4.13,1.1,.15),(7.01,.6,.06)]]
a=preset('fm.bell','玻璃钟','钟琴 / 敲击','非整数频率比与衰减层次；短音也留有明亮尾部。',FM,dict(operators=x,algorithm=2,decay=1.4,sustain=.08,release=1.0),.79,['金属','长尾'])
x=[dict(ratio=r,level=l,decay=d,sustain=.03,detune=0) for r,l,d in [(1,1,.4),(1.41,2,.2),(2,.4,.3),(3.46,1.2,.05)]]
b=preset('fm.steel','金属小盘','钟琴 / 敲击','非谐和起音之后回到主体，适合点缀与短动机。',FM,dict(operators=x,algorithm=1,decay=.42,sustain=.08,release=.26),.83,['金属','短动机'])
family('metal-keys','金属敲击','melody','清亮长尾与短促金属片',[a,b])
x=cp(FM['operators']);x[1].update(ratio=2,level=.6,sustain=.62);x[2].update(ratio=3,level=.6);x[3].update(ratio=1,level=.45,sustain=.7)
a=preset('fm.organ','数字风琴','键盘','稳定泛音与轻微颤动，适合延长和弦。',FM,dict(operators=x,decay=.12,sustain=.86,release=.09,chorus=.35,vibrato=2,lfoRate=5.5),.6,['持续','风琴'])
x=cp(FM['operators']);x[1].update(ratio=.5,level=2.6,sustain=.12);x[2].update(ratio=2,level=.46);x[3].update(ratio=4,level=1.6,sustain=.06)
b=preset('fm.reed','数码簧片','主音','空心簧片感与力度变化，适合中音区旋律。',FM,dict(operators=x,decay=.32,sustain=.54,release=.2,vibrato=4,lfoRate=5),.67,['空心','主音'])
family('digital-tone','数字键盘','melody','持续风琴与簧片主音',[a,b])
x=[dict(ratio=r,level=l,decay=d,sustain=s,detune=0) for r,l,d,s in [(1,1,1,.6),(1,1.3,1.8,.4),(2,.9,2,.6),(3,1.2,1.4,.3)]]
a=preset('fm.orbit','轨道玻璃','氛围','串联调制缓慢展开，适合少量长音。',FM,dict(operators=x,algorithm=3,attack=.3,decay=1.6,sustain=.64,release=1.5,chorus=.55),.66,['流动','数字'])
x=cp(FM['operators']);x[1].update(ratio=4,level=2.9,decay=.08);x[2].update(ratio=1,level=1.1,decay=.32);x[3].update(ratio=9,level=.5,decay=.07)
b=preset('fm.crystal','棱镜短键','键盘','短促数字键声，起音与尾部的泛音明显不同。',FM,dict(operators=x,algorithm=0,attack=.003,decay=.22,sustain=.06,release=.12),.95,['短促','棱镜'])
family('digital-motion','数字色彩','texture','长音变化与短键点缀',[a,b])

DR=dict(version=1,type='electronic-kit',kickPitch=48,kickDecay=.45,click=.07,snarePitch=170,snareDecay=.19,snareHigh=1200,hatDecay=.055,hatHigh=7500,metal=.0)
kitids=[]
for slug,name,desc,ch,gain in [
 ('round','圆润电子鼓','深底鼓、柔和军鼓与短镲，适合温暖电子编排。',dict(kickDecay=.6,snareDecay=.17,hatDecay=.047),.84),
 ('punch','紧实电子鼓','较短底鼓与鲜明噪声起音，节奏重心清楚。',dict(kickPitch=57,kickDecay=.24,click=.14,snarePitch=210,snareDecay=.16,snareHigh=1800,hatHigh=8600,metal=1),.86),
 ('dry','干燥口袋鼓','低音短、边击清楚，适合真人微时差或半拍节奏。',dict(kickPitch=44,kickDecay=.28,click=.035,snarePitch=155,snareDecay=.105,snareHigh=650,hatHigh=4900,hatDecay=.036),.87),
 ('metal','金属电路鼓','高频金属镲与短促硬边，适合脉冲编排。',dict(kickPitch=54,kickDecay=.22,click=.17,snarePitch=250,snareDecay=.11,snareHigh=2300,hatHigh=6700,metal=1.4,hatDecay=.06),.76),
]:
    pid=preset('drum.'+slug,name,'鼓组',desc,DR,ch,gain,['电子鼓',slug]);kitids.append(pid)
family('electronic-kits','电子鼓组','drums','四种明确不同的起音与尾部',kitids)

# MIDI based material. Actual onset offsets retained in data, including performed=True.
gmd=json.loads((ROOT/'catalog/gmd-selected.json').read_text())
for t in gmd:
    lineages[t['id']]=t.pop('lineage'); templates.append(t)
for fid,label in [('hand-pop','手奏流行'),('hand-soul','手奏灵魂'),('hand-fill','手奏过门')]:
    ids=[t['id'] for t in templates if t['familyId']==fid]
    family(fid,label,'drums','GMD真人演奏；保留力度与起音位置',ids,'rhythm',['真人','保留律动'])

# Authored 4-bar drum phrase families; changes are written into ordinary events.
specs=[
 ('four','四拍城市',118,{36:[0,4,8,12],38:[4,12],42:[2,6,10,14],39:[12]},'round'),
 ('pocket','半拍口袋',84,{36:[0,7,14],38:[8],42:[0,2,5,6,8,10,12,14],37:[15]},'dry'),
 ('broken','折线电步',110,{36:[0,6,10],38:[4,12],42:[0,3,6,8,11,14],37:[7,15]},'punch'),
 ('motor','夜行脉冲',126,{36:[0,4,8,12],38:[12],42:[2,4,6,8,10,12,14],45:[7]},'metal'),
 ('airy','留白水面',76,{36:[0,10],37:[6,14],42:[2,7,11]},'dry'),
 ('shuffle','三分轻摆',96,{36:[0,8],38:[4,12],42:[0,8/3,4,20/3,8,32/3,12,44/3]},'round'),
]
variants=['基本型','留白版','推进版','短过门','收尾']
for fid,label,bpm,parts,kit in specs:
    members=[]
    for vi,variant in enumerate(variants):
        ns=[]
        for bar in range(4):
            for pitch,positions in parts.items():
                for i,step in enumerate(positions):
                    if vi==1 and pitch==42 and i%2:continue
                    if vi==4 and bar==3 and step>8:continue
                    # Alternate second bar subtle arrangement, not random corruption.
                    pos=step*STEP
                    if fid=='pocket' and pitch==42 and i%2:pos+=36
                    strength=.82 if pitch==36 else .66 if pitch in (38,39) else .45 if i%2==0 else .3
                    ns.append(dict(pitch=pitch,start=round(bar*BAR+pos,6),duration=min(STEP,4*BAR-(bar*BAR+pos)),velocity=round(strength*(1 if bar%2==0 else .94),4),performed=True))
            if vi==2:
                for step in [3,7,11,15]:ns.append(dict(pitch=42,start=bar*BAR+step*STEP,duration=STEP,velocity=.24+.04*(bar%2),performed=True))
            if bar in [1,3] and vi==0 and fid in ['broken','pocket']:ns.append(dict(pitch=37,start=bar*BAR+13*STEP,duration=STEP,velocity=.28,performed=True))
            if bar==3 and vi==3:
                ns=[n for n in ns if n['start']<bar*BAR+12*STEP]
                for step,pitch,vel in [(12,38,.45),(13,38,.63),(14,45,.68),(15,45,.8)]:ns.append(dict(pitch=pitch,start=bar*BAR+step*STEP,duration=STEP,velocity=vel,performed=True))
            if bar==3 and vi==4:ns.append(dict(pitch=49,start=bar*BAR,duration=STEP,velocity=.46,performed=True))
        by={}
        for n in ns:
            k=(n['pitch'],n['start'])
            if k not in by or by[k]['velocity']<n['velocity']:by[k]=n
        ns=sorted(by.values(),key=lambda n:(n['start'],n['pitch']))
        id=f'studio.rhythm.{fid}.{vi+1}';members.append(id)
        templates.append(dict(id=id,version=1,type='pattern',kind='drum',role='drums',name=label+' · '+variant,description='四小节电子鼓句。'+['基础节奏与后半句小变化。','减少镲片，保留节奏重心。','增加轻击与推动感。','最后一拍接入短过门。','最后一小节留下收尾空间。'][vi],bars=4,key=0,scale='major',presetId='studio.drum.'+kit,drumkitId='builtin.standard',bpm=bpm,tags=['原创电子','已含律动',variant],notes=ns,familyId=fid,variant=variant))
        lineages[id]=dict(source='Original GridTone authored drum phrase',license='MIT',family=fid,variation=variant)
    family(fid,label,'drums','同一风格的基本、留白、推进、过门与收尾',members,'rhythm',['电子',str(bpm)+' BPM'])

# Bass / chord / melody rhythm templates, paired with combinations in runtime.
companion_specs=[
 ('bounce','弹跳','bass',[0,3,6,8,11,14],[2,2,1,2,2,1],[0,0,7,0,12,7],'studio.va.pluckbass'),
 ('anchor','稳固','bass',[0,6,8,14],[5,1,5,1],[0,7,0,12],'studio.va.round'),
 ('sync','切分','bass',[0,5,7,10,14],[3,1,2,3,1],[0,7,12,0,7],'studio.fm.slap'),
 ('stabs','反拍轻弹','chords',[2,6,10,14],[1.2,1.2,1.2,1.2],[0,0,0,0],'studio.va.stab'),
 ('arp','往返分解','chords',[0,2,4,6,8,10,12,14],[1.7]*8,[0,4,7,12,7,4,7,4],'studio.fm.harp'),
 ('answer','问答节奏','melody',[0,3,7,12],[2,2,3,2],[0,2,4,7],'studio.fm.koto'),
 ('space','留白旋律','melody',[0,6,10],[3,2,4],[0,7,4],'studio.fm.bell'),
 ('motif','重复动机','melody',[0,2,4,10,12,14],[1,1,3,1,1,2],[0,2,4,0,4,7],'studio.va.pulselead')]
for fid,label,role,starts,lens,pitches,pid in companion_specs:
    members=[]
    for vi in range(2):
        ns=[]
        for bar in range(4):
            for i,(step,length,dp) in enumerate(zip(starts,lens,pitches)):
                if vi and bar==3 and i>len(starts)//2:continue
                base=36 if role=='bass' else 60
                chord=[0,4,7] if fid=='stabs' else [dp]
                for note in chord:ns.append(dict(pitch=base+note,start=bar*BAR+step*STEP,duration=min(length*STEP,4*BAR-(bar*BAR+step*STEP)),velocity=.7 if i==0 else .57))
        id=f'studio.part.{fid}.{vi+1}';members.append(id)
        templates.append(dict(id=id,version=1,type='pattern',kind='melodic',role=role,name=label+(' · 基本型' if vi==0 else ' · 收尾留白'),description='C大调原始材料；可整体移调。也可仅用它的节奏骨架。',bars=4,key=0,scale='major',presetId=pid,bpm=100,tags=['原创',role,'基本型' if vi==0 else '收尾'],notes=ns,familyId=fid,variant='基本型' if vi==0 else '收尾'))
        lineages[id]=dict(source='Original GridTone musical template',license='MIT')
    family(fid,label,role,'可独立放入，也可作为节奏骨架',members,'rhythm')

kits=[]
for pid in kitids:
    slug=pid.rsplit('.',1)[1]
    kits.append(dict(id='studio.kit.'+slug,version=1,name=next(p['name'] for p in presets if p['id']==pid),rows=[dict(pitch=pitch,name=nm,en=en,role=role,velocity=1,source=dict(type='drum',pitch=pitch,presetId=pid)) for pitch,role,nm,en in [(36,'kick','底鼓','KICK'),(38,'snare','军鼓','SNARE'),(42,'closedHat','闭镲','CLOSED HAT'),(46,'openHat','开镲','OPEN HAT'),(39,'clap','拍手','CLAP'),(45,'tom','通鼓','TOM'),(49,'crash','吊镲','CRASH'),(37,'rim','边击','RIM')]]))
combos=[
 dict(id='studio.combo.warm',name='复古暖光',bpm=108,key=0,progression='doo',rhythmFamily='four',drum='round',bass='va.round',chords='va.brass',melody='fm.harp',bassPattern='anchor',chordStyle='pulse',motif=[0,2,4,7,4,2],melodySteps=[0,3,6,8,12,14],description='稳定四拍、暖铜和弦和水滴拨弦；适合明亮短旋律。'),
 dict(id='studio.combo.city',name='清亮都市',bpm=102,key=2,progression='soft',rhythmFamily='hand-soul',drum='dry',bass='fm.slap',chords='fm.tine',melody='fm.koto',bassPattern='sync',chordStyle='sync',motif=[7,4,2,4,0,2],melodySteps=[1,4,7,10,12,15],description='手奏灵魂节奏、切分FM低音与玻璃电钢。'),
 dict(id='studio.combo.night',name='夜间口袋',bpm=84,key=9,progression='minor-breath',rhythmFamily='pocket',drum='dry',bass='fm.woodbass',chords='fm.softkeys',melody='fm.steel',bassPattern='anchor',chordStyle='whole',motif=[0,7,4,2],melodySteps=[0,5,9,14],description='半拍空间、干燥鼓和金属点缀，旋律留白明显。'),
 dict(id='studio.combo.pulse',name='脉冲电子',bpm=124,key=0,progression='minor-axis',rhythmFamily='motor',drum='metal',bass='va.acid',chords='va.stab',melody='va.sawlead',bassPattern='bounce',chordStyle='arp',motif=[0,2,4,2,7,4,2,0],melodySteps=[0,2,4,6,8,10,12,14],description='共振低音、机械推动和分解音型；短音清楚。'),
 dict(id='studio.combo.air',name='空旷微光',bpm=76,key=5,progression='sus',rhythmFamily='airy',drum='round',bass='va.round',chords='va.darkpad',melody='fm.bell',bassPattern='anchor',chordStyle='whole',motif=[4,7,2],melodySteps=[0,7,12],description='稀疏鼓、暗色音垫和长尾玻璃钟，音符数量克制。'),
 dict(id='studio.combo.edge',name='锐利折线',bpm=112,key=7,progression='axis',rhythmFamily='broken',drum='punch',bass='va.rubber',chords='va.stab',melody='fm.crystal',bassPattern='sync',chordStyle='sync',motif=[0,4,7,2,4],melodySteps=[0,3,6,10,13],description='折线节奏、橡胶低音与短数字键，强调交错起音。'),
]
for c in combos:
    c.update(version=1,type='recipe',role='song',bars=8,license='MIT',tags=['组合',c['rhythmFamily']])
    family(c['id'],c['name'],'song',c['description'],[c['id']],'combo')

# Each combination is a small family: full starting point, sparse, and a real ending.
expanded=[]
for c in combos:
    ids=[]
    for slug,label in [('','完整起点'),('.sparse','留白版'),('.ending','收尾版')]:
        item=cp(c);item['id']=c['id']+slug;item['baseId']=c['id'];item['variant']=label;item['variantMode']=slug.lstrip('.') or 'full'
        if slug:item['name']=c['name']+' · '+label
        item['license']='MIT + CC-BY-4.0' if c['rhythmFamily'].startswith('hand-') else 'MIT'
        expanded.append(item);ids.append(item['id']);lineages[item['id']]=dict(source='Original GridTone composition kit',license=item['license'],rhythmFamily=c['rhythmFamily'])
    f=next(f for f in families if f['defaultId']==c['id']);f['members']=ids
combos=expanded

pack=dict(format='gridtone.catalog',version=1,id='studio.library.v1',name='Classic Studio · 内置声音与节奏',presets=presets,drumkits=kits,templates=templates,assets={})
(ROOT/'catalog/studio.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
(ROOT/'catalog/studio-families.json').write_text(json.dumps(families,ensure_ascii=False,indent=2)+'\n')
(ROOT/'catalog/studio-combos.json').write_text(json.dumps(combos,ensure_ascii=False,indent=2)+'\n')
(ROOT/'catalog/studio-sources.json').write_text(json.dumps(lineages,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(presets=len(presets),drumkits=len(kits),templates=len(templates),families=len(families),combos=len(combos))))
