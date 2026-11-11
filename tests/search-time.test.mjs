import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../dist/server/index.js';
import {timeError} from '../dist/server/time-rules.js';
const actualNow=Date.now;const now=Date.parse('2026-11-09T09:00:00+08:00');Date.now=()=>now;
const result=[];const check=(label,a,b)=>{assert.deepEqual(a,b,label);result.push(label)};
const db=new DatabaseSync(':memory:');
for(const f of ['../migrations/0001_initial.sql','../drizzle/0002_rooms.sql','../drizzle/0003_room_event_integrity.sql','../drizzle/0004_integrity_constraints.sql'])db.exec(readFileSync(new URL(f,import.meta.url),'utf8'));
const DB={prepare(q){const stmt=db.prepare(q);return {bind(...args){return {first:()=>stmt.get(...args),all:()=>({results:stmt.all(...args)}),run:()=>stmt.run(...args)}}}},batch(s){db.exec('BEGIN');try{const r=s.map(x=>x.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
async function api(path,body,user){const r=await worker.fetch(new Request('https://test.example/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.token}:{}),'Idempotency-Key':crypto.randomUUID()},body:body?JSON.stringify(body):undefined}),{DB});return {status:r.status,data:await r.json()}}
const [student,admin]=await Promise.all(['student','admin'].map(async actor=>(await api('login',{actor,password:'DemoAV-2026'})).data));
const slot=(h,m=0)=>'2026-11-10T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00+08:00';
const q=(start,end)=>new URLSearchParams({start,end});
check('器材預約成功',(await api('reservations',{tag:'CAM-01',start:slot(10),end:slot(11)},student)).status,201);
const a=await api('assets?'+q(slot(10,30),slot(11,30)),null,student);
check('重疊器材不出現在結果',a.data.some(x=>x.tag==='CAM-01'),false);
check('相鄰器材時段仍可借',(await api('assets?'+q(slot(11),slot(12)),null,student)).data.some(x=>x.tag==='CAM-01'),true);
await api('rooms',{id:'T1',name:'測試教室',location:'教學樓',capacity:30,projector:1,accessible:1},admin);
await api('room-reservations',{room_id:'T1',start:slot(10),end:slot(11),people:5,purpose:'課程小組討論'},student);
check('重疊教室不出現在結果',(await api('rooms?'+q(slot(10,30),slot(11,30)),null,student)).data.some(x=>x.id==='T1'),false);
check('相鄰教室時段仍可借',(await api('rooms?'+q(slot(11),slot(12)),null,student)).data.some(x=>x.id==='T1'),true);
for(const [label,start,end,contains] of [
 ['結束早於開始',slot(11),slot(10),'結束時間必須晚於'],
 ['結束等於開始',slot(10),slot(10),'結束時間必須晚於'],
 ['跨日',slot(10),'2026-11-11T11:00:00+08:00','同一天'],
 ['未對齊半小時',slot(10,15),slot(11,15),'30分鐘為單位'],
 ['超過四小時',slot(10),slot(15),'最多4小時'],
 ['缺少開始','',slot(11),'完整選擇']
]){
 for(const resource of ['assets','rooms']){const r=await api(resource+'?'+q(start,end),null,student);check(resource+' '+label+' HTTP',r.status,400);check(resource+' '+label+' 提示',r.data.error.includes(contains),true)}
}
check('器材營業時間',(await api('assets?'+q(slot(8),slot(9)),null,student)).data.error.includes('09:00至17:00'),true);
check('教室營業時間',(await api('rooms?'+q(slot(7),slot(8)),null,student)).data.error.includes('08:00至22:00'),true);
check('後端建立預約也拒絕倒序',(await api('reservations',{tag:'AUD-01',start:slot(11),end:slot(10)},student)).status,400);
check('後端建立教室也拒絕倒序',(await api('room-reservations',{room_id:'T1',start:slot(11),end:slot(10),people:2,purpose:'課程小組討論'},student)).status,400);
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];new vm.Script(script);
check('前後端共用同一段時間判斷',script.replace(/\r\n/g,'\n').includes(timeError.toString().replace(/\r\n/g,'\n')),true);
for(const text of ['searchRevision','借用流程','borrower-history','常見問題','查詢條件已變更'])check('介面包含 '+text,html.includes(text),true);
Date.now=actualNow;
writeFileSync(new URL('./search-time-results.json',import.meta.url),JSON.stringify({passed:result.length,checks:result},null,2));
console.log('Passed '+result.length+' search and time checks');
