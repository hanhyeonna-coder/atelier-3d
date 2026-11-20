export const loading=document.getElementById('loading');
export const loadingMessage=document.getElementById('loadingMessage');
export const controlHint=document.getElementById('controlHint');
export const centerHint=document.getElementById('centerHint');
export const status=document.getElementById('statusToast');
export const workTimer=document.getElementById('workTimer');
export const artUpload=document.getElementById('artUpload');
export const artModal=document.getElementById('artModal');
export const artPreview=document.getElementById('artPreview');
export const artMeta=document.getElementById('artMeta');
export const artLikeBtn=document.getElementById('artLikeBtn');
export const artArchiveSection=document.getElementById('artArchiveSection');
export const artArchiveTitle=document.getElementById('artArchiveTitle');
export const artArchiveGrid=document.getElementById('artArchiveGrid');
export const artClose=document.getElementById('artClose');
export const historyBtn=document.getElementById('historyBtn');
export const historyModal=document.getElementById('historyModal');
export const historyClose=document.getElementById('historyClose');
export const currentProgressSection=document.getElementById('currentProgressSection');
export const historySummary=document.getElementById('historySummary');
export const historyGrid=document.getElementById('historyGrid');
export const progressCarousel=document.getElementById('progressCarousel');
export const progressMeta=document.getElementById('progressMeta');
export const completeWorkBtn=document.getElementById('completeWorkBtn');
export const deleteCurrentWorkBtn=document.getElementById('deleteCurrentWorkBtn');
export const completedTitle=document.getElementById('completedTitle');
export const completedGrid=document.getElementById('completedGrid');
export const accountBtn=document.getElementById('accountBtn');
export const accountModal=document.getElementById('accountModal');
export const accountClose=document.getElementById('accountClose');
export const accountEmail=document.getElementById('accountEmail');
export const accountAction=document.getElementById('accountAction');
export const logoutBtn=document.getElementById('logoutBtn');
export const accountState=document.getElementById('accountState');
export const accountTitle=document.getElementById('accountTitle');
export const accountDesc=document.getElementById('accountDesc');

export const IS_KO=(navigator.language||'').toLowerCase().startsWith('ko');
export const t=(ko,en)=>IS_KO?ko:en;

export function applyLocaleUI(){
  document.documentElement.lang=IS_KO?'ko':'en';
  document.title=t('좀비 화실','Zombie Atelier');
  controlHint.textContent=t(
    '클릭: 이동/스툴 앉기 · 드래그: 시점 · 휠: 줌 · WASD/방향키: 직접 이동',
    'Click to move or sit · Drag to look around · Scroll to zoom · WASD/arrow keys to move'
  );
  historyBtn.textContent=t('내 그림 진행 기록','My Work');
  accountBtn.textContent='👤';
  accountBtn.setAttribute('aria-label',t('내 계정','My account'));
  accountBtn.title=t('내 계정','My account');
  accountTitle.textContent=t('내 좀비 화실 계정','My Zombie Atelier Account');
  accountDesc.textContent=t(
    '이메일로 로그인하면 폰과 컴퓨터에서 같은 작품 진행 기록을 이어볼 수 있어요.',
    'Sign in with your email to keep the same artwork history across your phone and computer.'
  );
  accountEmail.placeholder=t('이메일 주소','Email address');
  accountAction.textContent=t('로그인 링크 받기','Email me a sign-in link');
  logoutBtn.textContent=t('로그아웃','Sign out');
  historySummary.textContent=t('현재 작품 진행 과정','Current work in progress');
  completeWorkBtn.textContent=t('작품 완성하고 보관하기','Mark as finished');
  deleteCurrentWorkBtn.textContent=t('이 작품 폐기하기','Discard this work');
  completedTitle.textContent=t('완성 작품 보관함','Finished works');
  artArchiveTitle.textContent=t('완성 작품 보관함','Finished works');
  artPreview.alt=t('작품 크게 보기','Large artwork preview');
  artClose.setAttribute('aria-label',t('닫기','Close'));
  historyClose.setAttribute('aria-label',t('닫기','Close'));
  accountClose.setAttribute('aria-label',t('닫기','Close'));
  const likeLabel=artLikeBtn.querySelector('.label');
  if(likeLabel)likeLabel.textContent=t('좋아요','Like');
}

let statusHideTimer=null;
export function showStatus(message,ms=2200){
  status.textContent=message;
  status.classList.add('show');
  clearTimeout(statusHideTimer);
  statusHideTimer=setTimeout(()=>status.classList.remove('show'),ms);
}
