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
  controlHint.textContent=t(
    '클릭: 이동/스툴 앉기 · 드래그: 시점 · 휠: 줌 · WASD/방향키: 직접 이동',
    'Click: move/sit · Drag: look · Wheel: zoom · WASD/arrow keys: move'
  );
  historyBtn.textContent=t('내 그림 진행 기록','My Art Progress');
  accountBtn.textContent='👤';
  accountTitle.textContent=t('내 아틀리에 계정','My Atelier Account');
  accountDesc.textContent=t(
    '이메일로 로그인하면 폰과 컴퓨터에서 같은 작품 진행 기록을 이어볼 수 있어요.',
    'Log in by email to continue the same artwork progress across devices.'
  );
  accountAction.textContent=t('로그인 링크 받기','Send login link');
  historySummary.textContent=t('현재 작품 진행 과정','Current artwork progress');
  completeWorkBtn.textContent=t('작품 완성하고 보관하기','Complete & archive');
  deleteCurrentWorkBtn.textContent=t('이 작품 폐기하기','Discard this artwork');
  completedTitle.textContent=t('완성 작품 보관함','Completed artworks');
  artPreview.alt=t('작품 크게 보기','Artwork preview');
}

let statusHideTimer=null;
export function showStatus(message,ms=2200){
  status.textContent=message;
  status.classList.add('show');
  clearTimeout(statusHideTimer);
  statusHideTimer=setTimeout(()=>status.classList.remove('show'),ms);
}
