import vm from 'node:vm';
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
const student=(await api('login',{actor:'student',password:'DemoAV-2026'})).data;
const other=(await api('login',{actor:'student2',password:'DemoAV-2026'})).data;
const desk=(await api('login',{actor:'desk',password:'DemoAV-2026'})).data;
const slot=h=>'2026-11-09T'+String(h).padStart(2,'0')+':00:00+08:00';
await api('reservations',{tag:'CAM-01',start:slot(10),end:slot(11)},student);
const row=db.prepare("SELECT * FROM loans WHERE tag='CAM-01'").get();
time=Date.parse('2026-11-09T10:15:00+08:00');
expect('取件期限整點取消被拒絕',(await api('reservations/'+row.id+'/cancel',{},student)).status,409);
expect('已逾期仍保留原紀錄',db.prepare('SELECT status FROM loans WHERE id=?').get(row.id).status,'已預約');
expect('拒絕取消未新增成功請求',db.prepare('SELECT COUNT(*) n FROM requests').get().n,1);
expect('他人不得取消',(await api('reservations/'+row.id+'/cancel',{},other)).status,404);
time=Date.parse('2026-11-09T10:14:59.999+08:00');
expect('期限前取消成功',(await api('reservations/'+row.id+'/cancel',{},student)).status,200);
const insert=db.prepare('INSERT INTO loans(id,tag,student,start,end,status,actor) VALUES(?,?,?,?,?,?,?)');
const ids=[];
for(let i=0;i<56;i++){const id=crypto.randomUUID();ids.push(id);insert.run(id,'AUD-01','student',Date.parse(slot(8))+i*1000,Date.parse(slot(9))+i*1000,'已取消','student')}
const borrowed=crypto.randomUUID();insert.run(borrowed,'TRI-01','student',Date.parse(slot(10)),Date.parse(slot(11)),'已取件','desk');
expect('已取件不能取消',(await api('reservations/'+borrowed+'/cancel',{},student)).status,409);
const foreign=crypto.randomUUID();insert.run(foreign,'CAM-01','student2',Date.parse(slot(12)),Date.parse(slot(13)),'已取消','student2');
expect('學生不得讀借用人紀錄',(await api('desk/borrowers/student/loans',null,student)).status,403);
const first=await api('desk/borrowers/student/loans',null,desk);
expect('櫃台查詢成功',first.status,200);expect('總數含目前及歷史',first.data.total,58);
expect('未歸還統計',first.data.borrowed,1);expect('第一頁50筆',first.data.rows.length,50);
expect('只包含指定借用人',first.data.rows.every(x=>x.student==='student'),true);
expect('器材名稱有回傳',first.data.rows.every(x=>typeof x.asset_name==='string'),true);
const second=await api('desk/borrowers/student/loans?cursor='+encodeURIComponent(first.data.next_cursor),null,desk);
expect('第二頁補齊歷史',second.data.rows.length,8);expect('末頁游標為空',second.data.next_cursor,null);
expect('跨頁無重複',new Set([...first.data.rows,...second.data.rows].map(x=>x.id)).size,58);
expect('不明借用人404',(await api('desk/borrowers/notfound/loans',null,desk)).status,404);
expect('錯誤游標400',(await api('desk/borrowers/student/loans?cursor=bad',null,desk)).status,400);
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const context={Date,escape:x=>String(x),fmt:x=>String(x),icon:()=>'',field:()=>'',form:()=>'<button>取消預約</button>'};vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('const status=l=>'),html.indexOf('function results(')),context);
const card=l=>vm.runInContext('loan('+JSON.stringify(l)+',false)',context);
time=Date.parse('2026-11-09T10:15:00+08:00');
expect('逾期卡片標示',card(row).includes('已逾期'),true);
expect('逾期卡片無取消',card(row).includes('取消預約'),false);
time=Date.parse('2026-11-09T10:14:59.999+08:00');
expect('期限前顯示取消',card(row).includes('取消預約'),true);
expect('已取件無取消',card({...row,status:'已取件'}).includes('取消預約'),false);
expect('櫃台卡片有借用人入口',vm.runInContext('loan('+JSON.stringify(row)+',true)',context).includes('data-borrower="student"'),true);
Date.now=realNow;
console.log('Passed '+results.length+' expiry and borrower-history checks');
