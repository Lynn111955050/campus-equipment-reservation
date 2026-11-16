export async function initializeUsers(env,roles,now){
 const sql=(q,...args)=>env.DB.prepare(q).bind(...args);
 await env.DB.batch([...Object.entries({...roles,'系統':'系統'}).map(([account,role])=>
  sql('INSERT OR IGNORE INTO users(id,account,role,active,created) VALUES(?,?,?,?,?)',crypto.randomUUID(),account,role,role==='系統'?0:1,now)
 )]);
 // Link bounded batches of known historical references without removing the original text.
 await env.DB.batch([
  sql("UPDATE audit SET loan_id=ref WHERE id IN (SELECT a.id FROM audit a JOIN loans l ON l.id=a.ref AND l.tag=a.tag WHERE a.loan_id IS NULL AND a.repair_id IS NULL AND a.action IN ('建立預約','已預約','已取消','已取件','已歸還') LIMIT 200)"),
  sql("UPDATE audit SET repair_id=ref WHERE id IN (SELECT a.id FROM audit a JOIN repairs p ON p.id=a.ref AND p.tag=a.tag WHERE a.loan_id IS NULL AND a.repair_id IS NULL AND a.action IN ('故障停借','維修結案') LIMIT 200)")
 ]);
}
