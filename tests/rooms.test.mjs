import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const realNow=Date.now;
let time=realNow();
Date.now=()=>time;
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../drizzle/0002_rooms.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../drizzle/0003_room_event_integrity.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../drizzle/0004_integrity_constraints.sql',import.meta.url),'utf8'));
 const DB={
  prepare(query){
   const stmt=db.prepare(query);
   return {bind(...args){return {first:()=>stmt.get(...args),all:()=>({results:stmt.all(...args)}),run:()=>stmt.run(...args)}}};
  },
  batch(statements){
   db.exec('BEGIN');
   try{const result=statements.map(stmt=>stmt.run());db.exec('COMMIT');return result}
   catch(error){db.exec('ROLLBACK');throw error}
  }
 };
 async function api(path,body,user,key=crypto.randomUUID()){
  const response=await worker.fetch(new Request('https://test.example/api/'+path,{
   method:body?'POST':'GET',
   headers:{...(user?{Authorization:'Bearer '+user.token}:{}),'Idempotency-Key':key},
   body:body?JSON.stringify(body):undefined}),{DB});
  return {status:response.status,data:await response.json()};
 }
 return {db,api};
}
const day=new Date(time+2*86400000+28800000).toISOString().slice(0,10);
const slot=(hour,minutes=0)=>day+'T'+String(hour).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':00+08:00';
const {db,api}=setup();
const [student,other,admin,desk]=await Promise.all(['student','student2','admin','desk'].map(async actor=>(await api('login',{actor,password:'DemoAV-2026'})).data));
for(const [id,capacity] of [['R1',20],['R2',40],['R3',50],['R4',60]]){
 assert.equal((await api('rooms',{id,name:'測試教室'+id,location:'教學大樓',capacity,projector:'1',accessible:'1'},admin)).status,201);
}
const payload={room_id:'R1',start:slot(10),end:slot(11),people:10,purpose:'課程小組討論'};
const key=crypto.randomUUID();
const booking=await api('room-reservations',payload,student,key);
assert.equal(booking.status,201);
assert.equal((await api('room-reservations',payload,student,key)).status,200);
assert.equal((await api('room-reservations',payload,other)).status,409);
assert.equal((await api('room-reservations',{...payload,room_id:'R2'},student)).status,409);
assert.equal((await api('room-reservations',{...payload,room_id:'R2',people:99},other)).status,409);
assert.equal((await api('room-reservations/'+booking.data.id+'/cancel',{},other)).status,404);
assert.equal((await api('room-reservations',{...payload,room_id:'R2',start:slot(11),end:slot(12)},student)).status,201);
assert.equal((await api('room-reservations',{...payload,room_id:'R3',start:slot(12),end:slot(13)},student)).status,201);
assert.equal((await api('room-reservations',{...payload,room_id:'R4',start:slot(13),end:slot(14)},student)).status,409);
const schedule=await api('rooms/R1/schedule?date='+day,undefined,other);
assert.equal(schedule.status,200);
assert.equal(schedule.data.length,1);
assert.equal(schedule.data[0].student,undefined);
assert.equal(schedule.data[0].purpose,undefined);
time=Date.parse(slot(10))-10*60000;
// Refresh sessions after changing the test clock.
const st=(await api('login',{actor:'student',password:'DemoAV-2026'})).data;
const ad=(await api('login',{actor:'admin',password:'DemoAV-2026'})).data;
assert.equal((await api('room-reservations/'+booking.data.id+'/checkin',{},st)).status,200);
assert.equal((await api('rooms/R1/status',{status:'停用',note:'設備維護暫停使用'},ad)).status,409);
assert.equal((await api('room-reservations/'+booking.data.id+'/finish',{},st)).status,200);
assert.equal((await api('room-reservations/'+booking.data.id+'/finish',{},st)).status,409);
assert.equal((await api('room-reservations/'+booking.data.id+'/checkin',{},st)).status,409);
assert.equal((await api('rooms/R2/status',{status:'停用',note:'教室維護暫停使用'},ad)).status,200);
assert.equal(db.prepare("SELECT status FROM room_reservations WHERE room_id='R2'").get().status,'已取消');
time=Date.parse(slot(12,15));
const refreshed=(await api('login',{actor:'student',password:'DemoAV-2026'})).data;
const mine=await api('room-reservations/me',undefined,refreshed);
assert.equal(mine.data.find(row=>row.room_id==='R3').status,'未簽到');
const later=(await api('login',{actor:'student2',password:'DemoAV-2026'})).data;
assert.equal((await api('room-reservations',{...payload,room_id:'R3',start:slot(12,30),end:slot(13)},later)).status,201);
// A failing audit write must roll back the reservation and the retry record together.
db.exec("CREATE TRIGGER audit_failure BEFORE INSERT ON room_events WHEN NEW.action='建立預約' BEGIN SELECT RAISE(ABORT,'TEST_AUDIT_FAILURE'); END;");
const before=db.prepare('SELECT count(*) n FROM room_reservations').get().n;
assert.equal((await api('room-reservations',{...payload,room_id:'R4',start:slot(14),end:slot(15)},refreshed)).status,503);
assert.equal(db.prepare('SELECT count(*) n FROM room_reservations').get().n,before);
Date.now=realNow;
console.log('Passed room creation, capacity and equipment filtering, overlap rejection, user conflicts, quotas, retry, access isolation, schedule privacy, check-in, finish, closure, no-show release and transaction rollback');

