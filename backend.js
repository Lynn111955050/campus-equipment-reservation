import {html} from './page.js';
const demo={student:'學生',student2:'學生',desk:'櫃台',admin:'管理員'};
const messages={ASSET_UNAVAILABLE:'器材目前維修中或不存在',SLOT_CONFLICT:'此時段已被預約'};
function reply(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
function fail(message,status=400){return reply({error:message},status)}
function slots(start,end){
 const now=Date.now();
 const a=new Date(start+28800000), b=new Date(end+28800000);
 return Number.isFinite(start)&&Number.isFinite(end)&&start>now&&start<now+1209600000&&end-start>=1800000&&end-start<=14400000&&start%1800000===0&&end%1800000===0&&a.toISOString().slice(0,10)===b.toISOString().slice(0,10)&&a.getUTCHours()>=9&&b.getUTCHours()*60+b.getUTCMinutes()<=1020;
}
const application = {async fetch(req,env){
 const url=new URL(req.url), path=url.pathname, method=req.method;
 if(path==='/'&&method==='GET') return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8','X-Content-Type-Options':'nosniff'}});
 if(!path.startsWith('/api/'))return fail('頁面不存在',404);
 if(!env.DB)return fail('共享資料庫尚未配置',503);
 const sql=(q,...args)=>env.DB.prepare(q).bind(...args);
 const list=async(q,...args)=>(await sql(q,...args).all()).results;
 const one=(q,...args)=>sql(q,...args).first();
 const now=Date.now();
 try {
 if(method==='POST'&&req.headers.get('Origin')&&req.headers.get('Origin')!==url.origin&&req.headers.get('Origin')!=='https://lynn111955050.github.io')return fail('來源不符',403);
 const body=method==='POST'?await req.json():{};
 if(path==='/api/login'&&method==='POST'){
  const actor=String(body.actor??'').trim().toLowerCase();
  if(!Object.hasOwn(demo,actor)||body.password!=='DemoAV-2026')return fail('帳號或密碼錯誤',401);
  const token=crypto.randomUUID()+crypto.randomUUID();
  await env.DB.batch([sql('DELETE FROM sessions WHERE expires<=?',now),sql('INSERT INTO sessions VALUES(?,?,?,?)',token,actor,demo[actor],now+7200000),
  sql("INSERT OR IGNORE INTO assets(tag,name,category) VALUES ('CAM-01','Sony 影音相機','相機'),('AUD-01','無線領夾麥克風','收音'),('TRI-01','專業攝影腳架','腳架')")]);
  return reply({token,actor,role:demo[actor]});
 }
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
 const user=await one('SELECT actor,role FROM sessions WHERE token=? AND expires>?',token,now);
 if(!user)return fail('請先登入或重新登入',401);
 const {actor,role}=user;
 const start=Date.parse(body.start??url.searchParams.get('start')),end=Date.parse(body.end??url.searchParams.get('end'));
 if(method==='GET'){
  if(path==='/api/assets'&&role==='學生'){
   if(!slots(start,end))return fail('請選擇未來 14 天內同一天 09:00 至 17:00 的半小時時段，長度 30 分鐘至 4 小時');
   return reply(await list("SELECT a.*,EXISTS(SELECT 1 FROM loans l WHERE l.tag=a.tag AND l.status='已取件' AND l.end<=?) overdue FROM assets a WHERE a.status='可借' AND NOT EXISTS(SELECT 1 FROM loans l WHERE l.tag=a.tag AND l.status<>'已取消' AND l.start<? AND l.end>?) ORDER BY tag LIMIT 50",now,end,start));
  }
  if(path==='/api/reservations/me'&&role==='學生')return reply(await list('SELECT * FROM loans WHERE student=? ORDER BY start DESC LIMIT 100',actor));
  if(path==='/api/desk'&&role==='櫃台'){
   const day=url.searchParams.get('date')||new Date(now+28800000).toISOString().slice(0,10);
   const t=Date.parse(day+'T00:00:00+08:00');
   if(!Number.isFinite(t))return fail('日期格式錯誤');
   return reply(await list("SELECT * FROM loans WHERE status='已取件' OR (status='已預約' AND start>=? AND start<?) ORDER BY start LIMIT 100",t,t+86400000));
  }
  if(path==='/api/maintenance'&&role==='管理員')return reply(await list('SELECT * FROM repairs ORDER BY opened DESC LIMIT 100'));
  if(path==='/api/audit'&&role==='管理員')return reply(await list('SELECT * FROM audit WHERE tag=? ORDER BY id DESC LIMIT 100',url.searchParams.get('tag')??''));
  return fail('沒有此操作的權限',403);
 }
 if(method!=='POST')return fail('方法不支援',405);
 const key=req.headers.get('Idempotency-Key');
 if(!key||!/^[a-f0-9-]{36}$/i.test(key))return fail('缺少請求識別碼');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path+JSON.stringify(body)));
 const fingerprint=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const prior=await one('SELECT fingerprint FROM requests WHERE actor=? AND key=?',actor,key);
 if(prior)return prior.fingerprint===fingerprint?reply({message:'操作已成功完成'}):fail('同一請求識別碼不可改用其他操作',409);
 const tag=String(body.tag??'').trim().toUpperCase();
 const action=path.match(/^\/api\/reservations\/([a-f0-9-]+)\/(cancel|checkout|return)$/);
 const close=path.match(/^\/api\/maintenance\/([a-f0-9-]+)\/close$/);
 const id=crypto.randomUUID();
 const remember=sql('INSERT INTO requests VALUES(?,?,?)',actor,key,fingerprint);
 let stmts=[],success=200;
 if(path==='/api/reservations'&&role==='學生'){
  if(!slots(start,end))return fail('預約時段不符合規則');
  stmts=[sql('INSERT INTO loans(id,tag,student,start,end,actor) VALUES(?,?,?,?,?,?)',id,tag,actor,start,end,actor)];success=201;
 }else if(action){
  const [,loan,op]=action;
  if(role!==(op==='cancel'?'學生':'櫃台'))return fail('沒有此操作的權限',403);
  const current=await one('SELECT * FROM loans WHERE id=?',loan);
  if(!current||(op==='cancel'&&current.student!==actor))return fail('查無預約',404);
  if(op==='cancel')stmts=[sql("UPDATE loans SET status='已取消',reason='學生取消',actor=? WHERE id=? AND student=? AND status='已預約' AND start>?",actor,loan,actor,now)];
  if(op==='checkout'){
   if(tag!==current.tag||String(body.student??'').trim().toLowerCase()!==current.student)return fail('學生帳號或器材標籤不符',409);
   stmts=[sql("UPDATE loans SET status='已取件',picked=?,actor=? WHERE id=? AND status='已預約' AND start<=? AND start+900000>? AND EXISTS(SELECT 1 FROM assets WHERE tag=loans.tag AND status='可借') AND NOT EXISTS(SELECT 1 FROM loans x WHERE x.tag=loans.tag AND x.status='已取件')",now,actor,loan,now,now)];
  }
  if(op==='return'){
   if(tag!==current.tag)return fail('器材標籤不符',409);
   const note=String(body.note??'').trim();
   if(!['正常','故障'].includes(body.condition)||(body.condition==='故障'&&(!note||note.length>300)))return fail('請選擇驗收結果，故障需填 1 至 300 字');
   stmts=[sql("UPDATE loans SET status='已歸還',returned=?,reason=?,actor=? WHERE id=? AND status='已取件'",now,body.condition,actor,loan)];
   if(body.condition==='故障')stmts.push(sql('INSERT INTO repairs(id,tag,loan,note,opened) SELECT ?,tag,id,?,? FROM loans WHERE id=? AND changes()=1',id,note,now,loan));
  }
 }else if(path==='/api/assets'&&role==='管理員'){
  const name=String(body.name??'').trim();
  if(!/^[A-Z0-9-]{1,20}$/.test(tag)||!name||name.length>80||!['相機','收音','腳架'].includes(body.category))return fail('器材資料格式錯誤');
  stmts=[sql('INSERT INTO assets(tag,name,category) VALUES(?,?,?)',tag,name,body.category),sql("INSERT INTO audit(tag,actor,action) VALUES(?,?,'登錄器材')",tag,actor)];success=201;
 }else if(close&&role==='管理員'){
  const note=String(body.note??'').trim();
  if(!note||note.length>300)return fail('請填寫 1 至 300 字的復測紀錄');
  stmts=[sql('UPDATE repairs SET closed=?,resolution=? WHERE id=? AND closed IS NULL',now,note,close[1]),
   sql("INSERT INTO audit(tag,actor,action,ref) SELECT tag,?,'維修結案',id FROM repairs WHERE id=? AND changes()=1",actor,close[1]),
   sql("UPDATE assets SET status='可借' WHERE tag=(SELECT tag FROM repairs WHERE id=?) AND changes()=1",close[1])];
 }else return fail('沒有此操作的權限',403);
 // The guard executes inside the same batch. A failed first write makes the whole batch roll back.
 stmts.splice(1,0,sql('INSERT INTO requests SELECT NULL,?,? WHERE changes()=0',key,fingerprint));
 // Use a no-op update of the request row to preserve the successful changes() marker.
 stmts.splice(2,0,sql('UPDATE requests SET fingerprint=fingerprint WHERE actor=? AND key=?',actor,key));
 try {await env.DB.batch([remember,...stmts]);}
 catch(e){
  const replay=await one('SELECT fingerprint FROM requests WHERE actor=? AND key=?',actor,key);
  if(replay)return replay.fingerprint===fingerprint?reply({message:'操作已成功完成'}):fail('同一請求識別碼不可改用其他操作',409);
  const message=Object.entries(messages).find(([code])=>String(e).includes(code))?.[1];
  if(message)return fail(message,409);
  if(/UNIQUE|NOT NULL/.test(String(e)))return fail('狀態已變更、時段不符、前件未還或標籤重複，請重新整理',409);
  throw e;
 }
 return reply({message:'操作成功',id},success);
 } catch(error){console.error(error);return fail('系統暫時無法完成操作',503)}
}};


export default {async fetch(req,env){
 const origin=req.headers.get('Origin');
 const allowed=origin==='https://lynn111955050.github.io';
 if(req.method==='OPTIONS'){return new Response(null,{status:allowed?204:403,headers:allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key','Access-Control-Max-Age':'600','Vary':'Origin'}:{}})}
 const response=await application.fetch(req,env);
 if(!allowed)return response;
 const headers=new Headers(response.headers);headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');
 return new Response(response.body,{status:response.status,headers});
}};
