const U=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL;
const K=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
const rc=async c=>{const r=await fetch(U,{method:'POST',headers:{Authorization:'Bearer '+K},body:JSON.stringify(c)});const j=await r.json();if(j.error)throw new Error(j.error);return j.result};
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 const P=req.headers['x-pin'],adm=process.env.ADMIN_PIN,usr=process.env.APP_PIN;
 if(!U||!K||!(adm||usr))return res.status(500).json({error:'not configured'});
 const isAdm=!!adm&&P===adm,isUsr=isAdm||(!!usr&&P===usr);
 if(!isUsr)return res.status(401).json({error:'pin'});
 try{
  if(req.method==='GET'){
   if(req.query.audit){
    if(!isAdm)return res.status(403).json({error:'admin'});
    const a=await rc(['LRANGE','kasa:audit',0,199]);
    return res.status(200).json(a.map(x=>JSON.parse(x)));
   }
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
