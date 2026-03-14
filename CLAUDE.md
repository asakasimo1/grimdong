# 아이담 (Aiddam) — Claude 작업 가이드

> "오늘의 그림이 내일의 동화가 됩니다"

## 프로젝트 개요
아이들이 그린 그림을 AI 동화로 변환해주는 웹 서비스.
디자인 시안(HTML) + 실제 앱(React + Vite + Supabase) 함께 운영.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | React 19 + Vite 7 |
| 라우팅 | React Router DOM 7 |
| 상태관리 | Zustand 5 |
| 백엔드/DB | Supabase |
| 인증 | Supabase Auth + 카카오 OAuth |
| 캔버스 | Fabric.js 7 |
| 알림 | react-hot-toast |
| 언어 | JSX (TypeScript 미사용) |

---

## 프로젝트 구조

```
aidam_design/
├── CLAUDE.md              # 이 파일
├── setup.sh               # 새 PC 셋업 스크립트 (반드시 먼저 실행)
├── .githooks/
│   ├── post-commit        # 커밋 후 자동 push
│   └── post-merge         # pull 후 자동 npm install
│
├── index.html             # 앱 진입점
├── vite.config.js
├── package.json
│
├── src/
│   ├── main.jsx           # React 앱 마운트
│   ├── App.jsx            # 라우터 설정
│   ├── index.css          # 글로벌 스타일
│   ├── lib/
│   │   └── supabase.js    # Supabase 클라이언트
│   ├── store/
│   │   └── authStore.js   # Zustand 인증 스토어
│   └── pages/
│       ├── HomePage.jsx / .module.css
│       ├── LoginPage.jsx / .module.css
│       ├── DrawPage.jsx / .module.css    # 그림 그리기 (Fabric.js)
│       ├── StoryPage.jsx / .module.css  # AI 동화 생성
│       └── KakaoCallback.jsx
│
└── design/                # 디자인 시안 (참고용)
    ├── 01_refined.html    # 세련된 (Navy + Gold)
    ├── 02_cute.html       # 귀여운 (Pink + Blue)
    └── 03_trendy.html     # 트렌디 (Dark + Violet + Lime)
```

---

## GitHub & 브랜치 전략

- **레포**: `https://github.com/asakasimo1/grimdong`
- **작업 브랜치**: `app` ← 항상 이 브랜치에서 작업
- `main` 브랜치에는 직접 커밋하지 않음

---

## 새 PC 셋업 방법 (최초 1회)

```bash
# 1. 클론
git clone -b app https://github.com/asakasimo1/grimdong.git aidam_design
cd aidam_design

# 2. 자동 셋업 (git hooks + npm install + pull)
bash setup.sh

# 3. 환경 변수 파일 생성 (팀원에게 값 받기)
cp .env.example .env.local   # .env.local 에 실제 값 입력

# 4. 개발 서버 시작
npm run dev
```

> PAT(Personal Access Token) 인증: 처음 push 시 GitHub ID와 PAT를 입력하면
> macOS 키체인에 자동 저장되어 이후 자동 인증됨.

---

## 환경 변수 — Doppler로 중앙 관리

환경 변수는 **Doppler** 클라우드에서 관리. `.env.local` 파일 공유 불필요.

- 프로젝트명: `aidam` / config: `dev`
- 웹 대시보드: https://dashboard.doppler.com

관리하는 변수:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_KAKAO_JS_KEY
```

> 새 환경 변수 추가 시 Doppler 대시보드 → aidam → dev 에서 추가.
> `.env.local` 파일은 더 이상 사용하지 않음.

---

## 일상 작업 흐름

```bash
# 작업 시작 전 — 최신 코드 받기
git pull origin app

# 작업 후 — 커밋하면 자동으로 push됨
git add .
git commit -m "feat: 기능 설명"
# → post-commit hook이 자동으로 git push origin app 실행
```

---

## 코딩 컨벤션

### 파일/컴포넌트
- 컴포넌트 파일: `PascalCase.jsx` (예: `DrawPage.jsx`)
- CSS 모듈: `PascalCase.module.css` (컴포넌트와 동일명)
- 유틸/라이브러리: `camelCase.js`
- 스타일: **CSS Module 사용** (`import styles from './Page.module.css'`)

### 커밋 메시지
```
feat: 새 기능
fix: 버그 수정
style: UI/스타일 변경
refactor: 코드 리팩토링
chore: 설정, 패키지 변경
```

### React 규칙
- 함수형 컴포넌트만 사용 (`const Foo = () => {}`)
- 상태관리: 전역은 Zustand, 로컬은 `useState`
- 인증 상태: `authStore.js`에서 가져오기
- Supabase 클라이언트: `src/lib/supabase.js` 에서 import

---

## Claude 작업 지침

### 작업 전 확인
1. 현재 브랜치가 `app`인지 확인 (`git branch`)
2. 최신 코드인지 확인 (`git pull origin app`)
3. 기존 컴포넌트 패턴 파악 후 수정/추가

### 수정 원칙
- CSS 변수 및 CSS Module 패턴 유지
- `.env.local` 값은 직접 코드에 하드코딩 금지
- `node_modules`, `dist` 폴더 절대 수정 금지
- 새 페이지 추가 시 `App.jsx` 라우터에 등록

### 금지 사항
- `var` 사용 금지 → `const`/`let` 사용
- 인라인 스타일 남발 금지 → CSS Module 사용
- `.env.local` 커밋 금지
- `main` 브랜치에 직접 push 금지

### ⚠️ AI 변환 중요 규칙
- **draw/photo 모드 모두 `gpt-image-1` edit API (`/v1/images/edits`) 사용**
- GPT-4o Vision → DALL-E 3 두 단계 방식은 **반복적으로 오류 발생 — 절대 사용 금지**
- 변환 로직 위치: `src/components/TransformModal.jsx`의 `handleTransform` 함수

---

## 자주 쓰는 명령어

```bash
doppler run -- npm run dev      # 개발 서버 (환경변수 자동 주입)
doppler run -- npm run build    # 프로덕션 빌드
npm run preview                 # 빌드 결과 미리보기
npm run lint                    # ESLint 검사

doppler secrets                 # 현재 환경변수 목록 확인
doppler secrets set KEY=value   # 환경변수 추가/수정
```

---

## 디자인 시스템 (시안별 컬러 토큰)

**세련된 (Refined)**: Navy `#0D1B2A` + Gold `#C9A96E` + Cream `#F7F2EA`
**귀여운 (Cute)**: Pink `#FF8FAB` + Blue `#74B9FF` + BG `#FFF0F4`
**트렌디 (Trendy)**: Dark `#0A0A0F` + Violet `#7C3AED` + Lime `#A3E635`

공통 폰트: `Pretendard Variable` (한글), `Cafe24 Ssurround` (포인트)
