const IS_KO=(navigator.language||'').toLowerCase().startsWith('ko');

export function remainingExhibitionMs(seat){
  return Math.max(0,(seat?.artworkLockedUntil||0)-Date.now());
}

export function remainingExhibitionMinutes(seat){
  return Math.max(1,Math.ceil(remainingExhibitionMs(seat)/60000));
}

export function remainingExhibitionText(seat){
  const minutes=remainingExhibitionMinutes(seat);
  const hours=Math.floor(minutes/60);
  const rest=minutes%60;
  if(IS_KO){
    if(hours>0)return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
    return `${minutes}분`;
  }
  if(hours>0)return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
  return `${minutes} min`;
}

export function remainingExhibitionHoursLabel(seat){
  const ms=remainingExhibitionMs(seat);
  const hours=Math.max(1,Math.ceil(ms/3600000));
  return IS_KO?`${hours}시간`:`${hours} hr`;
}

export function isArtworkLocked(seat){
  return !!seat && remainingExhibitionMs(seat)>0;
}

export function blockedEaselStatus(seat){
  return IS_KO
    ? `다른 사람의 작품을 전시 중이에요. ${remainingExhibitionText(seat)} 뒤에 이 이젤에 내 그림을 올릴 수 있어요.`
    : `Someone else's artwork is on display here. You can replace it in ${remainingExhibitionText(seat)}.`;
}

export function blockedEaselPrompts(seat){
  return IS_KO
    ? [
        '다른 사람의 작품이 전시 중인 이젤이에요',
        `이 이젤에는 ${remainingExhibitionHoursLabel(seat)} 뒤에 올릴 수 있어요`,
        '다른 이젤에 내 그림을 전시해보아요'
      ]
    : [
        'Someone else’s artwork is on display here',
        `You can post here in ${remainingExhibitionHoursLabel(seat)}`,
        'Try another easel for now'
      ];
}
