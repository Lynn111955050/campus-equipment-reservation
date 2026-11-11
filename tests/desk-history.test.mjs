import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const realNow=Date.now;
let time=Date.parse('2026-11-09T09:00:00+08:00');
Date.now=()=>time;
const results=[];
function expect(label,actual,wanted){assert.deepEqual(actual,wanted,label);results.push(label)}
function setup(){
 const db=new DatabaseSync(':memory:');
 for(const f of ['../migrations/0001_initial.sql','../drizzle/0002_rooms.sql','../drizzle/0003_room_event_integrity.sql','../drizzle/0004_integrity_constraints.sql'])db.exec(readFileSync(new URL(f,import.meta.url),'utf8'));
 const DB={prepare(q){const stmt=db.prepare(q);return {bind(...a){return {first:()=>stmt.get(...a),all:()=>({results:stmt.all(...a)}),run:()=>stmt.run(...a)}}}},batch(stmts){db.exec('BEGIN');try{const result=stmts.map(s=>s.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}};
 const api=async(path,body,user,key=crypto.randomUUID())=>{
  const r=await worker.fetch(new Request('https://test.example/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.token}:{}),'Idempotency-Key':key},body:body?JSON.stringify(body):undefined}),{DB});
  return {status:r.status,data:await r.json()};
 };
 return {db,api};
}

const {db,api}=setup();
const desk=(await api('login',{actor:'desk',password:'DemoAV-2026'})).data;
const student=(await api('login',{actor:'student',password:'DemoAV-2026'})).data;
const insert=db.prepare('INSERT INTO loans(id,tag,student,start,end,status,actor) VALUES(?,?,?,?,?,?,?)');
for(let i=0;i<203;i++){
 const start=Date.parse(i<103?'2026-11-08T10:00:00+08:00':'2026-11-09T10:00:00+08:00')+i;
 insert.run(crypto.randomUUID(),'CAM-01','student',start,start+3600000,'已取消','student');
}
const first=await api('desk',null,desk);expect('未選日期總數',first.data.total,203);expect('第一頁100筆',first.data.rows.length,100);
const second=await api('desk?cursor='+encodeURIComponent(first.data.next_cursor),null,desk);const third=await api('desk?cursor='+encodeURIComponent(second.data.next_cursor),null,desk);
expect('最後頁3筆',third.data.rows.length,3);expect('最後頁停止',third.data.next_cursor,null);expect('所有頁無重複',new Set([...first.data.rows,...second.data.rows,...third.data.rows].map(x=>x.id)).size,203);
const filtered=await api('desk?date=2026-11-08',null,desk);expect('選日期才篩選',filtered.data.total,103);expect('包含已取消歷史',filtered.data.rows.every(x=>x.status==='已取消'),true);
expect('不合法日期拒絕',(await api('desk?date=2026-02-30',null,desk)).status,400);
expect('學生不能讀所有待辦',(await api('desk',null,student)).status,403);
expect('查詢不新增紀錄',db.prepare('SELECT COUNT(*) n FROM loans').get().n,203);
Date.now=realNow;console.log('Passed '+results.length+' desk all-date pagination checks');
