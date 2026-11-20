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
  if(hours<=0)return `${minutes}분`;
  return `${hours}시간 ${minutes}분`;
}
