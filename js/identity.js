const CLIENT_ID_KEY='atelier3d_client_id';
const DISPLAY_NAME_KEY='atelier3d_display_name';

const ARTIST_NAMES_KO=['고흐','피카소','모네','마티스','클림트','고갱','세잔','르누아르','샤갈','미로','달리','칸딘스키','뭉크','마네','드가'];
const ARTIST_QUIRKS_KO=['발가락 만지는','귀가 가려운','졸린 눈 비비는','커피 식은 줄 모르는','붓 어디 뒀는지 까먹은','창밖만 보는','하품 참는','콧노래 부르는','양말 한 짝 잃어버린','배고픈','딴생각하는','손에 물감 묻은','허리 펴는','연필 씹는','구름 세는'];
const ARTIST_NAMES_EN=['Van Gogh','Picasso','Monet','Matisse','Klimt','Gauguin','Cezanne','Renoir','Chagall','Miro','Dali','Kandinsky','Munch','Manet','Degas'];
const ARTIST_QUIRKS_EN=['Toe-Tapping','Itchy-Eared','Sleepy-Eyed','Coffee-Cold','Brush-Lost','Window-Gazing','Holding-a-Yawn','Humming','One-Sock-Missing','Hungry','Daydreaming','Paint-Smudged','Stretching','Pencil-Chewing','Cloud-Counting'];

export function hashString(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){
    h^=str.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

export function getOrCreateClientId(){
  let id=localStorage.getItem(CLIENT_ID_KEY);
  if(!id){
    id=crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY,id);
  }
  return id;
}

export function makeLocalizedDisplayName(id,isKorean){
  const h=hashString(id);
  const names=isKorean?ARTIST_NAMES_KO:ARTIST_NAMES_EN;
  const quirks=isKorean?ARTIST_QUIRKS_KO:ARTIST_QUIRKS_EN;
  return `${quirks[Math.floor(h/names.length)%quirks.length]} ${names[h%names.length]}`;
}

export function getOrCreateDisplayName(id,isKorean){
  let displayName=localStorage.getItem(DISPLAY_NAME_KEY);
  const needsLocaleRefresh=
    !displayName ||
    (isKorean && !/[가-힣]/.test(displayName)) ||
    (!isKorean && /[가-힣]/.test(displayName));

  if(needsLocaleRefresh){
    displayName=makeLocalizedDisplayName(id,isKorean);
    localStorage.setItem(DISPLAY_NAME_KEY,displayName);
  }
  return displayName;
}

export function saveDisplayName(displayName){
  localStorage.setItem(DISPLAY_NAME_KEY,displayName);
}
