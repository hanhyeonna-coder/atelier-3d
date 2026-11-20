export function parseTime(value){
  if(!value)return 0;
  const ms=new Date(value).getTime();
  return Number.isFinite(ms)?ms:0;
}

export function resolveArtworkExhibitionUntil(row,holdMs,now=Date.now()){
  if(!row)return 0;
  const explicit=parseTime(row.locked_until);
  const updated=parseTime(row.updated_at);
  const policyUntil=updated?updated+holdMs:0;
  const effective=Math.max(explicit,policyUntil);
  return effective>now?effective:0;
}

export function isExhibitionExpired(row,holdMs,now=Date.now()){
  const until=resolveArtworkExhibitionUntil(row,holdMs,now);
  return until===0;
}
