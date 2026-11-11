export function timeError(start,end,opening,closing,maxDays,now=Date.now()) {
 if(!Number.isFinite(start)||!Number.isFinite(end))return '請完整選擇開始時間與結束時間';
 if(end<=start)return '結束時間必須晚於開始時間，不能相同或早於開始時間';
 const a=new Date(start+28800000),b=new Date(end+28800000);
 if(a.toISOString().slice(0,10)!==b.toISOString().slice(0,10))return '開始與結束時間必須在同一天，請重新選擇結束時間';
 if(start<=now)return '開始時間必須晚於現在';
 if(start>=now+maxDays*86400000)return '只能預約未來'+maxDays+'天內的時段';
 if(a.getUTCHours()*60+a.getUTCMinutes()<opening*60||b.getUTCHours()*60+b.getUTCMinutes()>closing*60)return '借用時間須在每日'+String(opening).padStart(2,'0')+':00至'+String(closing).padStart(2,'0')+':00內';
 if(start%1800000!==0||end%1800000!==0)return '開始與結束時間須以30分鐘為單位，例如10:00或10:30';
 if(end-start<1800000||end-start>14400000)return '每次借用至少30分鐘，最多4小時';
 return '';
}
