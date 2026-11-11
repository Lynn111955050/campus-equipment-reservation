import {timeError} from './time-rules.js';
const reply = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
const fail = (message, status = 400) => reply({error:message}, status);

export function validRoomSlot(start, end, now = Date.now()) {
 if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
 const a = new Date(start + 28800000);
 const b = new Date(end + 28800000);
 return start > now && start < now + 30*86400000 &&
  end-start >= 1800000 && end-start <= 14400000 &&
  start%1800000 === 0 && end%1800000 === 0 &&
  a.toISOString().slice(0,10) === b.toISOString().slice(0,10) &&
  a.getUTCHours() >= 8 && b.getUTCHours()*60+b.getUTCMinutes() <= 1320;
}

export async function handleRooms(req, env, user, body) {
 const url = new URL(req.url);
 const path = url.pathname;
 if (!path.startsWith('/api/rooms') && !path.startsWith('/api/room-reservations')) return null;
 const {actor,role} = user;
 const now = Date.now();
 const sql = (query,...args) => env.DB.prepare(query).bind(...args);
 const one = (query,...args) => sql(query,...args).first();
 const list = async (query,...args) => (await sql(query,...args).all()).results;
 // Expiry is a deterministic maintenance step and preserves each reservation's history.
 await sql("UPDATE room_reservations SET status='未簽到',reason='超過開始後15分鐘未簽到',actor='系統' WHERE status='已預約' AND start+900000<=?",now).run();
 const get = req.method==='GET';
 if (get) {
  if (path==='/api/rooms') {
   const all = role==='管理員' && url.searchParams.get('all')==='1';
   const start = Date.parse(url.searchParams.get('start'));
   const end = Date.parse(url.searchParams.get('end'));
   const issue=all?'':timeError(start,end,8,22,30,now);if(issue)return fail(issue);
   const min = Number(url.searchParams.get('people') || 1);
   if(!Number.isInteger(min)||min<1||min>300) return fail('使用人數須為1至300人的整數');
   const rows = all ? await list("SELECT * FROM rooms ORDER BY id") :
    await list("SELECT r.*,EXISTS(SELECT 1 FROM room_reservations b WHERE b.room_id=r.id AND b.status='使用中' AND b.end<=?) overdue FROM rooms r WHERE r.status='開放' AND r.capacity>=? AND (?=0 OR r.projector=1) AND (?=0 OR r.accessible=1) AND NOT EXISTS(SELECT 1 FROM room_reservations b WHERE b.room_id=r.id AND b.status IN ('已預約','使用中','已結束') AND b.start<? AND b.end>?) ORDER BY r.capacity,r.id",now,min,url.searchParams.get('projector')==='1'?1:0,url.searchParams.get('accessible')==='1'?1:0,end,start);
   return reply(rows);
  }
  const schedule = path.match(/^\/api\/rooms\/([A-Z0-9-]+)\/schedule$/);
  if(schedule) {
   if(!await one('SELECT id FROM rooms WHERE id=?',schedule[1])) return fail('查無教室',404);
   const date = url.searchParams.get('date') || '';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('日期格式錯誤');
   const begin = Date.parse(date+'T00:00:00+08:00');
   return reply(await list("SELECT start,end,status FROM room_reservations WHERE room_id=? AND start>=? AND start<? AND status IN ('已預約','使用中','已結束') ORDER BY start",schedule[1],begin,begin+86400000));
  }
  if(path==='/api/room-reservations/me' && role==='學生') {
   return reply(await list("SELECT b.*,r.name,r.location,r.capacity FROM room_reservations b JOIN rooms r ON r.id=b.room_id WHERE b.student=? ORDER BY b.start DESC LIMIT 100",actor));
  }
  if(path==='/api/room-reservations' && ['櫃台','管理員'].includes(role)) {
   const date = url.searchParams.get('date') || new Date(now+28800000).toISOString().slice(0,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('日期格式錯誤');
   const begin = Date.parse(date+'T00:00:00+08:00');
   return reply(await list("SELECT b.*,r.name,r.location,r.capacity FROM room_reservations b JOIN rooms r ON r.id=b.room_id WHERE (b.start>=? AND b.start<?) OR b.status='使用中' ORDER BY b.start DESC LIMIT 100",begin,begin+86400000));
  }
  return fail('沒有此操作的權限',403);
 }
 if(req.method!=='POST') return fail('方法不支援',405);
 const key = req.headers.get('Idempotency-Key') || '';
 if(!/^[a-f0-9-]{36}$/i.test(key)) return fail('缺少請求識別碼');
 const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path+JSON.stringify(body)));
 const fingerprint = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const previous = await one('SELECT fingerprint FROM requests WHERE actor=? AND key=?',actor,key);
 if(previous) return previous.fingerprint===fingerprint ? reply({message:'操作已成功完成'}) : fail('同一識別碼的請求內容不同',409);
 let operation;
 let status = 200;
 let result = {message:'操作成功'};
 if(path==='/api/room-reservations' && role==='學生') {
  const start=Date.parse(body.start),end=Date.parse(body.end);
  const people=Number(body.people);
  const purpose=String(body.purpose??'').trim();
  const issue=timeError(start,end,8,22,30,now);if(issue)return fail(issue);
  if(!Number.isInteger(people)||people<1||people>300||purpose.length<5||purpose.length>200) return fail('請填寫正確人數與5至200字的用途');
  const id=crypto.randomUUID();
  operation=sql('INSERT INTO room_reservations(id,room_id,student,start,end,people,purpose,created,actor) VALUES(?,?,?,?,?,?,?,?,?)',id,String(body.room_id??''),actor,start,end,people,purpose,now,actor);
  status=201;
  result.id=id;
 } else if(path==='/api/rooms' && role==='管理員') {
  const id=String(body.id??'').trim().toUpperCase();
  const name=String(body.name??'').trim();
  const location=String(body.location??'').trim();
  const capacity=Number(body.capacity);
  if(!/^[A-Z0-9-]{1,20}$/.test(id)||name.length<1||name.length>60||location.length<1||location.length>100||!Number.isInteger(capacity)||capacity<1||capacity>300) return fail('請填完整教室名稱、位置、代碼及1至300人的容量');
  if(!['0','1'].includes(String(body.projector))||!['0','1'].includes(String(body.accessible))) return fail('設備選項格式錯誤');
  operation=sql('INSERT INTO rooms(id,name,location,capacity,projector,accessible,actor) VALUES(?,?,?,?,?,?,?)',id,name,location,capacity,Number(body.projector),Number(body.accessible),actor);
  status=201;
 } else {
  const action = path.match(/^\/api\/room-reservations\/([a-f0-9-]+)\/(cancel|checkin|finish)$/);
  const roomStatus = path.match(/^\/api\/rooms\/([A-Z0-9-]+)\/status$/);
  if(action) {
   const [,id,actionName]=action;
   const booking=await one('SELECT * FROM room_reservations WHERE id=?',id);
   if(!booking || (role==='學生' && booking.student!==actor)) return fail('查無可操作的預約',404);
   if(actionName==='cancel') {
    if(role!=='學生') return fail('請由預約人取消',403);
    operation=sql("UPDATE room_reservations SET status='已取消',reason='使用者取消',actor=? WHERE id=? AND student=? AND status='已預約' AND start>?",actor,id,actor,now);
   } else if(actionName==='checkin') {
    operation=sql("UPDATE room_reservations SET status='使用中',checked_in=?,actor=? WHERE id=? AND status='已預約' AND start-900000<=? AND start+900000>? AND EXISTS(SELECT 1 FROM rooms WHERE id=room_reservations.room_id AND status='開放') AND NOT EXISTS(SELECT 1 FROM room_reservations other WHERE other.room_id=room_reservations.room_id AND other.status='使用中')",now,actor,id,now,now);
   } else {
    operation=sql("UPDATE room_reservations SET status='已結束',finished=?,actor=? WHERE id=? AND status='使用中'",now,actor,id);
   }
  } else if(roomStatus && role==='管理員') {
   const state=String(body.status??'');
   const note=String(body.note??'').trim();
   if(!['開放','停用'].includes(state)||note.length<5||note.length>300) return fail('請填寫5至300字的開放或停用原因');
   operation=sql('UPDATE rooms SET status=?,note=?,actor=? WHERE id=? AND status<>?',state,note,actor,roomStatus[1],state);
  } else return fail('沒有此操作的權限',403);
 }
 try {
  await env.DB.batch([
   sql('INSERT INTO requests VALUES(?,?,?)',actor,key,fingerprint),
   operation,
   sql('INSERT INTO requests SELECT NULL,?,? WHERE changes()=0',key,fingerprint)
  ]);
 } catch(error) {
  const replay=await one('SELECT fingerprint FROM requests WHERE actor=? AND key=?',actor,key);
  if(replay) return replay.fingerprint===fingerprint ? reply({message:'操作已成功完成'}) : fail('同一識別碼的請求內容不同',409);
  const messages={
   ROOM_CLOSED:'教室目前停止開放',
   ROOM_CAPACITY:'使用人數超過教室容量',
   ROOM_CONFLICT:'這間教室的時段已被預約，請重新選擇',
   STUDENT_CONFLICT:'你已有同時段的教室預約',
   ROOM_QUOTA:'每人最多保留3筆尚未結束的教室預約',
   ROOM_OCCUPIED:'教室仍有人使用，請先結束使用再停用',
   ROOM_STATE:'此預約已完成或取消，無法再次操作'
  };
  const match=Object.entries(messages).find(([code])=>String(error).includes(code));
  if(match) return fail(match[1],409);
  if(/UNIQUE|NOT NULL/.test(String(error))) return fail('狀態已變更、代碼重複，或尚未到簽到時間、前一組尚未離場，請重新整理',409);
  throw error;
 }
 return reply(result,status);
}

