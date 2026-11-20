const IS_KO=(navigator.language||'').toLowerCase().startsWith('ko');

export function formatDuration(seconds){
  const total=Math.floor(Math.max(0,seconds));
  const hours=Math.floor(total/3600);
  const minutes=Math.floor((total%3600)/60);
  const secs=total%60;
  if(hours>0)return `${hours}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  return `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

export function formatTodayWork(seconds){
  const totalMinutes=Math.floor(Math.max(0,seconds)/60);
  const hours=Math.floor(totalMinutes/60);
  const minutes=totalMinutes%60;
  if(IS_KO){
    if(hours<=0)return `${minutes}분`;
    if(minutes===0)return `${hours}시간`;
    return `${hours}시간 ${minutes}분`;
  }
  if(hours<=0)return `${minutes} min`;
  if(minutes===0)return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function formatLocalDate(value){
  const date=value instanceof Date?value:new Date(value);
  return date.toLocaleDateString(IS_KO?'ko-KR':'en-US');
}
