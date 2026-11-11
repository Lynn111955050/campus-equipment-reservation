import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function setup(pages){
 const nodes=new Map();let calls=0,release;
 const node=()=>({innerHTML:'',textContent:'',hidden:false,disabled:false,open:true,addEventListener(){},querySelector(){return node()},insertAdjacentHTML(_,s){this.innerHTML+=s}});
 const context={console,URLSearchParams,Set,Map,Date,user:{role:'櫃台'},screen:'櫃台待辦',escape:String,fmt:String,icon:()=>'',status:x=>x.status,app:{addEventListener(){}},document:{querySelector(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}},api:async()=>{const i=calls++;if(release)await release.promise;return pages[i]}};
 vm.createContext(context);
 const ui=html.slice(html.indexOf('const borrowerDialog='),html.lastIndexOf('</script>'));
 vm.runInContext(ui,context);vm.runInContext("borrowerAccount='student';historyItem=row=>'<article>'+row.id+'</article>';",context);
 return {context,nodes,calls:()=>calls,load:more=>vm.runInContext('loadBorrowerHistory('+more+')',context),block(){let resolve;const promise=new Promise(r=>resolve=r);release={promise,resolve};return ()=>{release.resolve();release=null}}};
}
const row=id=>({id});const response=(rows,total,next_cursor)=>({rows:rows.map(row),total,next_cursor,reserved:0,expired:0,borrowed:0,returned:0,cancelled:total});
let checked=0;const check=(a,b)=>{assert.deepEqual(a,b);checked++};
const short=setup([response(['a','b'],2,null)]);await short.load(false);
for(let i=0;i<5;i++)await short.load(true);
check(short.calls(),1);check(short.nodes.get('#borrower-history-list').innerHTML,'<article>a</article><article>b</article>');check(short.nodes.get('#borrower-history-more').hidden,true);
const pages=setup([response(['a','b'],3,'next'),response(['b','c'],3,null)]);
await pages.load(false);await pages.load(true);await pages.load(true);
check(pages.calls(),2);check(pages.nodes.get('#borrower-history-list').innerHTML,'<article>a</article><article>b</article><article>c</article>');check(pages.nodes.get('#borrower-history-more').hidden,true);
const double=setup([response(['a'],2,'next'),response(['b'],2,null)]);await double.load(false);const unblock=double.block();const pending=double.load(true);await double.load(true);check(double.calls(),2);unblock();await pending;check(double.nodes.get('#borrower-history-list').innerHTML,'<article>a</article><article>b</article>');
const repeated=setup([response(['a'],2,'same'),response(['a'],2,'same')]);await repeated.load(false);await repeated.load(true);await repeated.load(true);check(repeated.calls(),2);check(repeated.nodes.get('#borrower-history-more').hidden,true);
check(html.includes('#borrower-history-more[hidden],.desk-more[hidden]{display:none!important}'),true);
check(html.includes("field('取件日期（選填）','date',selection.date||'','date').replace(' required','')"),true);
console.log('Passed '+checked+' actual frontend pagination checks');
