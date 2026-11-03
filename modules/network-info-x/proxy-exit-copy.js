// Surge independent panel: query egress IP through the configured routing path.
const endpoint = "https://api.ipify.org?format=json";
$httpClient.get({url:endpoint,timeout:10},(err,res,body)=>{
  if(err || !res || res.status !== 200){$done({title:"代理出口 IP",content:"查询失败，请检查网络和分流"});return;}
  let ip;try{ip=JSON.parse(body).ip}catch(e){}
  if(!ip || !/^[0-9a-f:.]+$/i.test(ip)){$done({title:"代理出口 IP",content:"无效的 IP 响应"});return;}
  $done({title:"代理出口 IP",content:ip});
});
