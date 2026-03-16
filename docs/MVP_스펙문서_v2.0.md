# 아이담 — MVP 기능 정의서 v2.0

**버전**: v2.0
**작성일**: 2026-03-16
**상태**: Part 1 완료 / Part 2 완료
**배포 URL**: https://grimdong-fuee.vercel.app
**GitHub**: https://github.com/asakasimo1/grimdong (`app` 브랜치)

---

## 목차

1. [서비스 개요](#1-서비스-개요)
2. [기술 스택 (실제 적용)](#2-기술-스택)
3. [화면 목록 (현재 구현)](#3-화면-목록)
4. [Part 1 — 그리기 & AI 변환](#4-part-1)
5. [Part 2 — 일기 텍스트 → AI 그림일기](#5-part-2)
6. [데이터베이스 스키마](#6-데이터베이스-스키마)
7. [API 구성](#7-api-구성)
8. [환경 변수](#8-환경-변수)
9. [미구현 / 다음 단계](#9-다음-단계)

---

## 1. 서비스 개요

### 1.1 서비스 한 줄 정의
> 초등 1~2학년(7~8세) 아이가 직접 그리거나 일기를 쓰면, AI가 지브리 스타일 그림일기로 변환해주는 웹 창작 플랫폼

### 1.2 핵심 기능 (현재 구현)

| 기능 | 경로 | 상태 |
|------|------|------|
| 카카오 소셜 로그인 | `/login` | ✅ 완료 |
| 기능 선택 화면 | `/select` | ✅ 완료 |
| 그리기 캔버스 + AI 변환 | `/draw` | ✅ 완료 |
| 그리기 결과 (저장/공유) | `/story` | ✅ 완료 |
| 일기 입력 (3모드) | `/diary` | ✅ 완료 |
| 일기 그림 결과 카드 | `/diary-result` | ✅ 완료 |
| 아이 프로필 설정 | `/settings` | ✅ 완료 |
| 내 그림일기 목록 | `/home` | ✅ 완료 |

---

## 2. 기술 스택

### 2.1 프론트엔드

| 라이브러리 | 버전 | 용도 |
|------------|------|------|
| React | 19 | UI 프레임워크 |
| Vite | 7 | 빌드 도구 |
| React Router DOM | 7 | SPA 라우팅 |
| Zustand | 5 | 전역 상태 관리 |
| Fabric.js | 6 | 드로잉 캔버스 |
| html2canvas | latest | 카드 캡처 (PNG 저장) |
| react-hot-toast | latest | 토스트 알림 |
| @sentry/react | latest | 에러 모니터링 |

### 2.2 백엔드 / 인프라

| 서비스 | 용도 |
|--------|------|
| Supabase | Auth + PostgreSQL DB + Storage |
| Vercel | 프론트엔드 배포 + Serverless Functions |
| Doppler | Secrets 관리 |

### 2.3 AI API

| API | 용도 |
|-----|------|
| Gemini 2.5 Flash | 일기 분석 (persons/places/imagePrompt 추출), 손글씨 OCR |
| GPT-4o Vision | 그림 묘사 (draw 모드) |
| DALL-E 3 | 그림 스타일 변환 (draw 모드) |
| gpt-image-1 | 사진 기반 스타일 변환 (photo 모드) |
| fal.ai FLUX.1 Kontext | 실제 인물 보존 + 지브리 스타일 변환 (diary, 사진 있음) |
| fal.ai FLUX.2 | 텍스트 기반 지브리 스타일 생성 (diary, 사진 없음) |

### 2.4 디자인 시스템

- **스타일**: 토스 미니멀
- **Primary Color**: `#3D5AFE` (인디고 블루)
- **Background**: `#F5F6FA`
- **폰트**: Pretendard (한국어), 시스템 폰트 fallback

---

## 3. 화면 목록

| ID | 경로 | 컴포넌트 | 설명 |
|----|------|----------|------|
| S01 | `/login` | LoginPage | 카카오 로그인 |
| S02 | `/kakao-callback` | KakaoCallback | OAuth 콜백 처리 |
| S03 | `/select` | SelectPage | 기능 선택 (그리기 / 일기) |
| S04 | `/home` | HomePage | 내 그림일기 목록 |
| S05 | `/draw` | DrawPage | 그리기 캔버스 + AI 변환 |
| S06 | `/story` | StoryPage | 그리기 결과 + 저장/공유 |
| S07 | `/diary` | DiaryInputPage | 일기 입력 (직접/사진/음성) |
| S08 | `/diary-result` | DiaryResultPage | 일기 그림 카드 결과 |
| S09 | `/settings` | SettingsPage | 아이 프로필 + 가족 사진 등록 |

---

## 4. Part 1 — 그리기 & AI 변환

### 4.1 DrawPage 기능

**그리기 도구**
- 브러시 4종: 연필, 원형붓, 스프레이, 스티커(이모지 10종)
- 색상 팔레트, 굵기 조절, 지우개, 전체 지우기, 실행취소
- 모드: 직접 그리기 / 사진 불러오기

**AI 변환 스타일 4종**
| 스타일 | 아이콘 | API |
|--------|--------|-----|
| 지브리 | 🏯 | GPT-4o Vision 묘사 → DALL-E 3 |
| 풍경화 | 🏞️ | GPT-4o Vision 묘사 → DALL-E 3 |
| 스케치 | ✏️ | GPT-4o Vision 묘사 → DALL-E 3 |
| 화보스타일 | ✨ | gpt-image-1 edit |

**변환 프롬프트**
- draw 모드: GPT-4o Vision → 묘사 텍스트 → DALL-E 3 생성 (`b64_json`)
- photo 모드: gpt-image-1 edit (원본 구도 보존)

### 4.2 StoryPage 기능

- 변환된 그림 표시
- AI 그림일기 텍스트 생성 (1인칭, 180~230자)
- 저장: 체크박스로 항목 선택 (내 그림 / 그림일기 카드)
- 공유: 모바일 Web Share API / PC 파일 다운로드

---

## 5. Part 2 — 일기 텍스트 → AI 그림일기

### 5.1 전체 플로우

```
SelectPage
  → DiaryInputPage (일기 입력)
      ↓ Gemini 2.5 Flash 분석
  → PhotoRequestModal (인물 사진 요청 + 이미지 생성)
      ↓ fal.ai FLUX 이미지 생성
  → DiaryResultPage (그림일기 카드)
      ↓ html2canvas 캡처
  → Supabase Storage 저장 + diaries 테이블 기록
```

### 5.2 DiaryInputPage — 3가지 입력 모드

| 모드 | 기술 | 동작 |
|------|------|------|
| ✏️ 직접 입력 | textarea | 키보드 직접 입력 |
| 📷 사진 인식 | Gemini 2.5 Flash Vision OCR | 손글씨 일기 사진 → 텍스트 추출 |
| 🎤 음성 입력 | Web Speech API (ko-KR, continuous) | 말하기 → 실시간 텍스트 변환 |

- 모든 모드에서 textarea 직접 수정 가능
- 최대 500자
- 10자 이상 입력 시 "그림 만들기!" 버튼 활성화

### 5.3 PhotoRequestModal

- Gemini 분석 결과에서 등장 인물 추출
- 각 인물의 등록된 사진 여부 표시 (✅ / 📷)
- 사진 클릭 → 업로드 → Supabase `profile-photos` 버킷 저장
- 파일명: `{user_id}/person_{ascii_key}.jpg` (한글 → ASCII 변환)

**인물 키 ASCII 매핑**

| 한글 | ASCII |
|------|-------|
| 아이 | child |
| 엄마 | mom |
| 아빠 | dad |
| 할머니 | grandma |
| 할아버지 | grandpa |
| 오빠 | brother_o |
| 언니 | sister_u |
| 남동생 | brother_y |
| 여동생 | sister_y |

### 5.4 이미지 생성 (api/diary.js)

**사진 있는 경우 — FLUX.1 Kontext [dev]**
```
프롬프트: Convert the person in the reference photo into Studio Ghibli anime style.
          Preserve facial features, hair color... Scene: {imagePrompt}
          Apply Ghibli characteristic soft warm colors, painterly backgrounds...
엔드포인트: https://fal.run/fal-ai/flux-kontext/dev
파라미터: image_url (레퍼런스 사진), num_inference_steps: 28
```

**사진 없는 경우 — FLUX.2 [dev]**
```
프롬프트: Studio Ghibli anime illustration style. {imagePrompt}
          Soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic...
엔드포인트: https://fal.run/fal-ai/flux-2
파라미터: image_size: square_hd, num_inference_steps: 28
```

### 5.5 DiaryResultPage — 그림일기 카드

**카드 구조**
```
┌─────────────────────────┐
│  날짜            ✦     │  ← cardHeader
├─────────────────────────┤
│                         │
│    AI 생성 삽화 (1:1)   │  ← illustWrap
│                         │
├─────────────────────────┤
│ 일기 텍스트             │  ← textArea (줄노트)
│ (repeating-gradient)    │
├─────────────────────────┤
│                아이담 ✦│  ← cardFooter
└─────────────────────────┘
```

**저장 방식**
- `html2canvas` 카드 전체 캡처 → PNG blob
- Supabase `drawings` 버킷 업로드
- `diaries` 테이블 기록 (user_id, date, diary_text, image_url, elements)

---

## 6. 데이터베이스 스키마

### 6.1 profiles 테이블

```sql
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id),
  name       TEXT,                    -- 아이 이름
  age        TEXT DEFAULT '8',        -- 나이 (5~10)
  gender     TEXT DEFAULT '여자',
  likes      TEXT[] DEFAULT '{}',     -- 좋아하는 것 (최대 5개)
  friends    TEXT[] DEFAULT '{}',     -- 친한 친구 (최대 3명)
  family     TEXT[] DEFAULT '{}',     -- 가족 구성
  pet        TEXT DEFAULT '',
  photos     JSONB DEFAULT '{}',      -- { persons: { 아이: url, 엄마: url }, places: {} }
  updated_at TIMESTAMPTZ
);
```

### 6.2 stories 테이블

```sql
CREATE TABLE stories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users NOT NULL,
  title      TEXT,
  image_url  TEXT,          -- AI 변환 이미지 URL
  story_text TEXT,          -- AI 생성 일기 텍스트
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 diaries 테이블 (Part 2 신규)

```sql
CREATE TABLE diaries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users NOT NULL,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  diary_text TEXT NOT NULL,
  image_url  TEXT,          -- 그림일기 카드 PNG URL
  elements   JSONB,         -- { persons, places, imagePrompt, mainPerson }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own diaries" ON diaries FOR ALL USING (auth.uid() = user_id);
```

### 6.4 Supabase Storage 버킷

| 버킷 | 용도 | 공개 |
|------|------|------|
| `drawings` | 그림 + 그림일기 카드 PNG | 공개 |
| `profile-photos` | 가족 사진 (레퍼런스) | 공개 |

---

## 7. API 구성

### 7.1 Vercel Serverless Functions

| 파일 | 메서드 | 용도 |
|------|--------|------|
| `api/transform.js` | POST | 그리기 AI 스타일 변환 (OpenAI) |
| `api/diary.js` | POST | 일기 AI 이미지 생성 (fal.ai FLUX) |

### 7.2 직접 호출 API (프론트엔드)

| API | 용도 | 인증 |
|-----|------|------|
| Gemini 2.5 Flash | 일기 분석, 손글씨 OCR | VITE_GEMINI_API_KEY |
| Supabase REST | DB CRUD, Auth | VITE_SUPABASE_ANON_KEY |

---

## 8. 환경 변수

| 변수 | 설명 | 위치 |
|------|------|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | 프론트엔드 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 익명 키 | 프론트엔드 |
| `VITE_KAKAO_JS_KEY` | 카카오 JS SDK 키 | 프론트엔드 |
| `VITE_GEMINI_API_KEY` | Google Gemini API 키 | 프론트엔드 |
| `OPENAI_API_KEY` | OpenAI API 키 | Vercel 서버리스 |
| `FAL_API_KEY` | fal.ai API 키 | Vercel 서버리스 |

---

## 9. 다음 단계

### 우선순위 높음
- [ ] HomePage — 내 그림일기 목록 상세 구현 (diaries + stories 통합 조회)
- [ ] AI 변환 모달 백드롭 탭 시 닫히는 버그 재조사
- [ ] 그림일기 상세 보기 페이지

### 우선순위 중간
- [ ] 오늘의 주제 카드 기능 (매일 그리기 주제 제공)
- [ ] 스트릭 / 배지 게임화 시스템
- [ ] 부모 포트폴리오 뷰어

### 우선순위 낮음
- [ ] 무료/유료(Freemium) 한도 관리
- [ ] 모바일 앱 (iOS/Android) — React Native 검토
- [ ] B2B 기관 어드민 대시보드
