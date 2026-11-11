import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import {verifyPassword} from '../dist/server/auth.js';
let checks=0;
const check=(fn)=>{fn();checks++};
const oldSchema=db=>{for(const f of ['0001_initial','0002_rooms','0003_room_event_integrity'])db.exec(readFileSync(new URL('../drizzle/'+f+'.sql',import.meta.url),'utf8'))};
const migration=readFileSync(new URL('../drizzle/0004_integrity_constraints.sql',import.meta.url),'utf8');
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');oldSchema(db);
db.exec("INSERT INTO assets VALUES('A','相機A','相機','可借'),('B','相機B','相機','可借'); INSERT INTO loans(id,tag,student,start,end,actor) VALUES('L','A','student',1,2,'student'); UPDATE loans SET status='已歸還',picked=1,returned=2 WHERE id='L'; INSERT INTO repairs VALUES('P','A','L','測試故障',3,NULL,NULL); INSERT INTO rooms VALUES('R','教室','大樓',40,1,1,'開放','','admin'); INSERT INTO room_reservations VALUES('RR','R','student',10,20,5,'測試小組討論','已預約',NULL,NULL,NULL,1,'student'); INSERT INTO room_events(room_id,actor,action,at) VALUES('R','admin','開放教室',1); INSERT INTO sessions VALUES('T','student','學生',999); INSERT INTO requests VALUES('student','K','F');");
const tables=['assets','loans','repairs','audit','requests','sessions','rooms','room_reservations','room_events'];
const snapshot=()=>Object.fromEntries(tables.map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()]));
const before=snapshot();db.exec('BEGIN');try{db.exec(migration);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
check(()=>assert.deepEqual(snapshot(),before,'migration preserves every field and event'));
check(()=>assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]));
for(const [table,key] of [['assets','tag'],['loans','id'],['repairs','id'],['sessions','token'],['rooms','id'],['room_reservations','id']]){
 check(()=>assert.equal(db.prepare('PRAGMA table_info('+table+')').all().find(x=>x.name===key).notnull,1));
 check(()=>assert.throws(()=>db.exec('UPDATE '+table+' SET '+key+'=NULL')));
}
check(()=>assert.throws(()=>db.exec("UPDATE loans SET status='非法狀態' WHERE id='L'"),/CHECK/));
check(()=>assert.throws(()=>db.exec("INSERT INTO loans(id,tag,student,start,end,status,actor) VALUES('BAD','B','student',30,40,'非法狀態','student')"),/CHECK/));
check(()=>assert.throws(()=>db.exec("UPDATE repairs SET tag='B' WHERE id='P'"),/FOREIGN KEY/));
check(()=>assert.throws(()=>db.exec("INSERT INTO repairs VALUES('P2','B','L','故障',4,NULL,NULL)")));
check(()=>assert.throws(()=>db.exec("UPDATE loans SET tag='B' WHERE id='L'"),/FOREIGN KEY/));
check(()=>assert.deepEqual(snapshot(),before,'rejected changes leave historical data intact'));
const broken=new DatabaseSync(':memory:');oldSchema(broken);broken.exec("INSERT INTO sessions VALUES(NULL,'student','學生',999)");broken.exec('BEGIN');
try{broken.exec(migration);assert.fail('invalid historical key must stop migration')}catch{broken.exec('ROLLBACK')}
check(()=>assert.equal(broken.prepare('SELECT COUNT(*) n FROM sessions WHERE token IS NULL').get().n,1));
check(()=>assert.equal(broken.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE '_v3_%'").get().n,0));
for(const actor of ['student','student2','desk','admin']){
 check(()=>assert.equal(readFileSync(new URL('../dist/server/auth.js',import.meta.url),'utf8').includes('DemoAV-2026'),false));
 assert.equal(await verifyPassword(actor,'DemoAV-2026'),true);checks++;
 assert.equal(await verifyPassword(actor,'wrong'),false);checks++;
}
assert.equal(await verifyPassword('missing','DemoAV-2026'),false);checks++;
const DB={prepare(q){const s=db.prepare(q);return {bind(...a){return {first:()=>s.get(...a),all:()=>({results:s.all(...a)}),run:()=>s.run(...a)}}}},batch(stmts){db.exec('BEGIN');try{const r=stmts.map(s=>s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
const api=async(path,body,token)=>{const r=await worker.fetch(new Request('https://test.example/api/'+path,{method:body?'POST':'GET',headers:token?{Authorization:'Bearer '+token}:{},body:body?JSON.stringify(body):undefined}),{DB});return {status:r.status,data:await r.json()}};
const login=await api('login',{actor:' STUDENT ',password:'DemoAV-2026'});check(()=>assert.equal(login.status,200));
check(()=>assert.equal('password' in login.data,false));
check(()=>assert.equal((readFileSync(new URL('../dist/server/index.js',import.meta.url),'utf8')).includes('DemoAV-2026'),false));
const insert=db.prepare("INSERT INTO assets(tag,name,category) VALUES(?,?,'相機')");for(let i=0;i<1000;i++)insert.run('C'+String(i).padStart(4,'0'),'相機'+i);
db.exec("INSERT INTO assets VALUES('ZZ-MIC','尾端麥克風','收音','可借')");
const day=new Date(Date.now()+115200000).toISOString().slice(0,10);
const query=new URLSearchParams({start:day+'T10:00:00+08:00',end:day+'T11:00:00+08:00',category:'收音'});
const filtered=await api('assets?'+query,null,login.data.token);
check(()=>assert.equal(filtered.status,200));check(()=>assert.equal(filtered.data.some(x=>x.tag==='ZZ-MIC'),true));check(()=>assert.equal(filtered.data.every(x=>x.category==='收音'),true));
query.set('category',"相機' OR 1=1 --");const invalid=await api('assets?'+query,null,login.data.token);check(()=>assert.equal(invalid.status,400));
query.delete('category');const all=await api('assets?'+query,null,login.data.token);check(()=>assert.equal(all.data.length,50));
console.log('Passed '+checks+' security, schema migration, and backend category checks');
