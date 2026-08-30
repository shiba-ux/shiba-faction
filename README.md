# FiveM Faction Community 1차 완성본

## 포함 기능
- 회원가입 / 로그인
- 고유 아이디와 닉네임 분리
- 프로필 수정
- 전체 실시간 채팅
- 친구 요청 / 수락 / 삭제
- 추억 사진 업로드 / 삭제
- 관리자 패널
- 관리자 설정 변경
- 사용자 킥 / 차단 / 차단 해제
- 관리자 추가 / 삭제
- 첫 가입 계정은 자동으로 관리자 권한 부여

## 실행 방법

1. Node.js 18 이상 설치
2. 이 폴더에서 터미널 실행
3. 아래 명령 실행

```bash
npm install
npm start
```

4. 브라우저에서 http://localhost:3000 접속

## 중요
- `data/db.json`에 사이트 데이터가 저장됩니다.
- `uploads/`에 업로드된 사진이 저장됩니다.
- 실제 공개 서버에 배포할 때는 반드시 `SESSION_SECRET` 환경변수를 강한 랜덤 문자열로 변경하세요.
- 이 1차 버전은 학습/프로토타입 목적입니다. 실제 공개 서비스에서는 PostgreSQL, Redis, CSRF 방어, rate limit, 이미지 검사/리사이징, HTTPS, 더 강한 인증 체계를 추가하는 것을 권장합니다.

## 직접 수정
- 사이트 디자인: `public/style.css`
- 화면/기능: `public/app.js`
- 서버/API: `server.js`
- 초기 설정: `data/db.json`


## Windows에서 가장 쉽게 실행하기

`start.bat`을 더블클릭하세요.

처음 실행할 때는 자동으로 `npm install`을 실행합니다.
그 후 서버가 켜지고 브라우저에서 `http://localhost:3000`으로 접속하면 됩니다.

**주의:** `server.js`는 더블클릭하지 마세요. 반드시 `start.bat` 또는 `npm start`로 실행해야 합니다.

서버 종료는 `start.bat` 창에서 `Ctrl+C`를 누르면 됩니다.
