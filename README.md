# Atelier 3D

온라인 산사처럼 자유롭게 돌아다니는 3D 온라인 화실 프로토타입입니다.

## 현재 구현
- Three.js / WebGL 기반 원형 파빌리온
- 3D 바닥, 기둥, 돔, 이젤, 의자, 꽃 장식
- 베레모 + 앞치마를 착용한 3D 아바타
- WASD / 방향키 이동
- 마우스 드래그로 시점 회전
- 걷기 시 양쪽 다리/팔 교차 애니메이션
- 스케치 상태 연필 / 채색 상태 팔레트
- 작업 타이머 클릭 시 자기 이젤로 이동 후 앉아서 그림 그리기
- 이젤 작품 클릭 시 대형 작품 뷰어
- 작업과정 슬라이더
- 주요 위치/깊이/라인 농도는 index.html의 CONFIG에서 조절 가능

## 직접 조절하기
`index.html` 상단의 `CONFIG`:
- `avatar.beretX / beretY / beretZ`: 베레모 위치
- `easel.artZ / frameZ / supportBarZ`: 그림과 이젤 프레임 깊이
- `floor.plankLineOpacity / ringLineOpacity`: 바닥 선 농도
- `flowers.density`: 꽃 장식 밀도

현재 Three.js를 CDN에서 불러오므로 실행 시 인터넷 연결이 필요합니다.
