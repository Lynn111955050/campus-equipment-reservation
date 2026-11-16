import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {validCalendarDate,validRequestKey} from '../dist/server/time-rules.js';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
for(const tag of ['0001_initial','0002_rooms','0003_room_event_integrity','0004_integrity_constraints','0005_session_security','0006_user_audit_links'])db.exec(readFileSync(new URL('../drizzle/'+tag+'.sql',import.meta.url),'utf8'));
const DB={prepare(q){const s=db.prepare(q);return {bind(...a){return {first:()=>s.get(...a),all:()=>({results:s.all(...a)}),run:()=>s.run(...a)}}}},batch(stmts){db.exec('BEGIN');try{const r=stmts.map(s=>s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
let checks=0;function check(value){assert(value);checks++}
async function call(path,body,token,key=crypto.randomUUID(),raw=false){const r=await worker.fetch(new Request('https://test.example/api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),'Idempotency-Key':key,'CF-Connecting-IP':'192.0.2.5'},body:body===undefined?undefined:raw?body:JSON.stringify(body)}),{DB});return {status:r.status,data:await r.json(),retry:r.headers.get('Retry-After')}}
check((await call('login','{',null,null,true)).status===400);
for(const value of [null,[],42,'text'])check((await call('login',value)).status===400);
check(validCalendarDate('2028-02-29'));for(const value of ['2026-02-29','2026-02-30','2026-04-31','2026-13-01','2026-2-01'])check(!validCalendarDate(value));
check(validRequestKey(crypto.randomUUID()));for(const value of ['a'.repeat(36),'00000000-0000-1000-8000-000000000000','00000000-0000-4000-0000-000000000000'])check(!validRequestKey(value));
const a=await call('login',{actor:'student',password:'DemoAV-2026'});const b=await call('login',{actor:'student',password:'DemoAV-2026'});check(a.status===200&&b.status===200);
check((await call('logout',{},a.data.token)).status===200);check((await call('reservations/me',undefined,a.data.token)).status===401);check((await call('reservations/me',undefined,b.data.token)).status===200);
check((await call('reservations',{},b.data.token,'a'.repeat(36))).status===400);
check((await call('rooms/R/schedule?date=2026-02-30',undefined,b.data.token)).status===404); // unknown room checked before date
await db.prepare("INSERT INTO rooms(id,name,location,capacity,projector,accessible,status,note,actor) VALUES('R','教室','大樓',40,1,1,'開放','','admin')").run();
check((await call('rooms/R/schedule?date=2026-02-30',undefined,b.data.token)).status===400);
const ad=await call('login',{actor:'admin',password:'DemoAV-2026'});check((await call('room-reservations?date=2026-04-31',undefined,ad.data.token)).status===400);
for(let i=0;i<5;i++)check((await call('login',{actor:'student2',password:'wrong'})).status===401);
const blocked=await call('login',{actor:'student2',password:'DemoAV-2026'});check(blocked.status===429&&blocked.retry==='900');
check((await call('login',{actor:'desk',password:'DemoAV-2026'})).status===200);
const real=Date.now;Date.now=()=>real()+900001;try{check((await call('login',{actor:'student2',password:'DemoAV-2026'})).status===200)}finally{Date.now=real}
const plan=db.prepare("EXPLAIN QUERY PLAN UPDATE room_reservations SET status='未簽到' WHERE status='已預約' AND start<=?").all(Date.now()-900000);check(plan.some(r=>r.detail.includes('room_expiry_lookup')));
console.log('Passed '+checks+' teacher review security and boundary checks');
