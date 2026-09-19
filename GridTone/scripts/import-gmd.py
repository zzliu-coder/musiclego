#!/usr/bin/env python3
"""Rebuild selected GMD excerpts from byte-verified Standard MIDI Files.
No model, network, third-party Python packages or quantization required.
"""
from pathlib import Path
import json, struct, hashlib
ROOT=Path(__file__).resolve().parents[1]
SOURCE={
 '7_pop-groove7_138_beat_4-4.mid':('f3e9ab1e65382dae15526caf33754095a2516f8b','drummer1/eval_session/7_pop-groove7_138_beat_4-4.mid','hand-pop','手奏流行',138),
 '10_soul-groove10_102_beat_4-4.mid':('c691635fb3255441afd667d5ac62a641a163a030','drummer1/eval_session/10_soul-groove10_102_beat_4-4.mid','hand-soul','手奏灵魂',102),
 '10_jazz-funk_116_fill_4-4.mid':('3ed4dc794103c5f245bc5839a45c1dee5688cda8','drummer1/session1/10_jazz-funk_116_fill_4-4.mid','hand-fill','手奏过门',116),
}
MAP={36:36,38:38,40:38,37:37,48:45,50:45,45:45,47:45,43:45,58:45,46:46,26:46,42:42,22:42,44:42,49:49,55:49,57:49,52:49,51:49,59:49,53:49,39:39}

def parse_midi(data):
    if data[:4]!=b'MThd': raise ValueError('Missing MIDI header')
    hlen,form,ntr,ppq=struct.unpack('>IHHH',data[4:14])
    if ppq&0x8000 or not ppq: raise ValueError('Expected metrical MIDI time')
    pos=8+hlen; notes=[]; ccs=[]; tempos=[]; maximum=0
    for _ in range(ntr):
        if data[pos:pos+4]!=b'MTrk': raise ValueError('Missing track chunk')
        size=struct.unpack('>I',data[pos+4:pos+8])[0];buf=data[pos+8:pos+8+size];pos+=8+size
        i=0;tick=0;running=None;active={}
        def vlq():
            nonlocal i
            v=0
            for _ in range(4):
                b=buf[i];i+=1;v=(v<<7)|(b&127)
                if b<128:return v
            raise ValueError('Invalid variable-length quantity')
        while i<len(buf):
            tick+=vlq();status=buf[i]
            if status>=128:i+=1
            else:
                if running is None:raise ValueError('Missing running status')
                status=running
            if status==0xff:
                typ=buf[i];i+=1;n=vlq();value=buf[i:i+n];i+=n
                if typ==0x51:tempos.append((tick,int.from_bytes(value,'big')))
                if typ==0x2f:break
                continue
            if status in (0xf0,0xf7):i+=vlq();continue
            running=status;kind=status&0xf0;channel=status&15
            length=1 if kind in (0xc0,0xd0) else 2;values=buf[i:i+length];i+=length
            if kind==0xb0:ccs.append([tick,channel,*values]);continue
            if kind not in (0x80,0x90):continue
            pitch,vel=values;key=(channel,pitch)
            if kind==0x90 and vel>0:active.setdefault(key,[]).append((tick,vel))
            elif active.get(key):
                start,v=active[key].pop(0);notes.append({'pitch':pitch,'start':start*960/ppq,'duration':max(1,(tick-start)*960/ppq),'velocity':round(v/127,6)})
        maximum=max(maximum,tick*960/ppq)
        for (_,pitch),ns in active.items():
            for start,v in ns:notes.append({'pitch':pitch,'start':start*960/ppq,'duration':min(240,max(1,maximum-start*960/ppq)),'velocity':round(v/127,6)})
    return sorted(notes,key=lambda n:(n['start'],n['pitch'])),ppq,maximum,ccs,tempos

def main():
    templates=[];receipts=[]
    for name,(expected,source,fam,label,bpm) in SOURCE.items():
        data=(ROOT/'vendor/gmd'/name).read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        if blob!=expected:raise ValueError('Source hash mismatch: '+name)
        notes,ppq,length,ccs,tempos=parse_midi(data)
        last=max(n['start'] for n in notes); bars=4 if fam!='hand-fill' else 1
        # Four non-overlapping phrases, starting at original bar 1. A short fill is one phrase.
        candidates=[0,4,8,12] if bars==4 else [0]
        for idx,start_bar in enumerate(candidates):
            start=start_bar*3840;end=start+bars*3840
            ns=[]
            for n in notes:
                if not start<=n['start']<end or n['pitch'] not in MAP:continue
                ns.append({**n,'pitch':MAP[n['pitch']],'start':round(n['start']-start,6),'duration':round(min(n['duration'],end-n['start']),6),'performed':True})
            if len(ns)<6:continue
            # Duplicate exact same role/onset hits may arise from Roland articulations.
            unique={}
            for n in ns:
                k=(n['pitch'],n['start']);old=unique.get(k)
                if not old or old['velocity']<n['velocity']:unique[k]=n
            ns=sorted(unique.values(),key=lambda n:(n['start'],n['pitch']))
            id=f'studio.rhythm.{fam}.{idx+1}'
            lineage={'dataset':'Groove MIDI Dataset','credit':'Google LLC','license':'CC-BY-4.0','sourceFile':source,'gitBlob':blob,'sha256':hashlib.sha256(data).hexdigest(),'sourceBars':[start_bar+1,start_bar+bars],'originalBpm':bpm,'sourcePpq':ppq,'mapping':'Roland TD-11 to 8-role kit; tom/ride articulations combined; CC4 omitted','timing':'Original onsets and velocities; no additional global swing/humanize'}
            templates.append({'id':id,'version':1,'type':'pattern','kind':'drum','role':'drums','name':f'{label} · {"短过门" if fam=="hand-fill" else "原演奏"+str(idx+1)}','description':'真人演奏截取；保留力度和微小时差。'+('适合句尾。' if bars==1 else '每四小节的内容自然变化。'),'bars':bars,'key':0,'scale':'major','presetId':'studio.drum.dry','drumkitId':'builtin.standard','bpm':bpm,'tags':['真人演奏','保留律动','过门' if bars==1 else '基本型'],'notes':ns,'lineage':lineage,'familyId':fam,'variant':'短过门' if bars==1 else ['基本型','原奏B','原奏C','原奏D'][idx]})
        receipts.append({'file':name,'gitBlob':blob,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'notes':len(notes),'sourcePpq':ppq,'durationTicks':length,'maxOnset':last,'ccEvents':len(ccs),'microtimingNotes':sum(n['start']%240!=0 for n in notes)})
    (ROOT/'catalog/gmd-selected.json').write_text(json.dumps(templates,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'vendor/gmd/receipts.json').write_text(json.dumps(receipts,indent=2)+'\n')
    print(json.dumps({'templates':len(templates),'receipts':receipts},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
