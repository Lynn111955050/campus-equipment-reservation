// Demonstration credentials: only per-account salted PBKDF2 digests are stored.
const credentials = {
 student:['21b3014ffd0f091a09a55f77dfcbeedb','e295a84527aba9dfe39f3b2978302928e7ca003248f833da0b7e58b83b92224d'],
 student2:['7651193302f78002fa58c1e2df873316','7aff5a44fb5e7775d3ca2104f07bca7ae83180e3a3f11272b4092bd15e05a0a8'],
 desk:['30e7faa84e1e72a30750c3910ae7c079','490e6fa0dd04a04a2fc9f2f8c8706d91715d6e09fb70788c9ca91736674e35d2'],
 admin:['86e3a2900116cfc6eac54f665b473878','9c50c2c06f93ef333152d192b49a1650037814aab58f016837fa402a35c86c52']
};
const bytes=hex=>Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));
export async function verifyPassword(actor,password){
 if(typeof password!=='string'||password.length>256)return false;
 const known=Object.hasOwn(credentials,actor);
 const [salt,expected]=credentials[known?actor:'student'];
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:bytes(salt),iterations:100000,hash:'SHA-256'},key,256));
 const wanted=bytes(expected);let difference=0;
 for(let i=0;i<wanted.length;i++)difference|=actual[i]^wanted[i];
 return known&&difference===0;
}
