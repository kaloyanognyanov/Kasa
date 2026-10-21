const U=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL||'PASTE_REST_URL_HERE';
const K=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN||'PASTE_REST_TOKEN_HERE';
const rc=async c=>{const r=await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+K},body:JSON.stringify(c)});const j=await r.json();if(j.error)throw new Error(j.error);return j.result};
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!/^https:/.test(U)||K.startsWith('PASTE'))return res.status(500).json({error:'not configured'});
 try{
  if(req.method==='GET'){
   const out={};
   for(const [k,h] of [['hist','kasa:day'],['weeks','kasa:week']]){
    const a=await rc(['HGETALL',h]);out[k]=[];
    for(let i=1;i<a.length;i+=2)out[k].push(JSON.parse(a[i]));
   }
   return res.status(200).json(out);
  }
  if(req.method==='POST'){
   const {t,rec}=req.body||{};
   const f=rec&&(t==='day'?rec.date:t==='week'?rec.ws:'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(f||''))return res.status(400).json({error:'bad'});
   const old=await rc(['HGET','kasa:'+t,f]);
   await rc(['HSET','kasa:'+t,f,JSON.stringify(rec)]);
   const o=old?JSON.parse(old):null;
   await rc(['LPUSH','kasa:audit',JSON.stringify({ts:new Date().toISOString(),t,key:f,who:String(rec.who||'').slice(0,60),tot:rec.tot,cnt:rec.cnt,diff:rec.diff,old:o?{tot:o.tot,cnt:o.cnt,diff:o.diff}:null})]);
   await rc(['LTRIM','kasa:audit',0,499]);
   return res.status(200).json({ok:1});
  }
  res.status(405).end();
 }catch(e){res.status(500).json({error:'server'})}
};
