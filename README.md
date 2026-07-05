# 별빛사주 V5 Hero Full Redesign

모바일 우선 AI 명리 상담 플랫폼입니다. V5는 Hero 첫 화면을 고급 게임 로그인 화면과 영화 오프닝처럼 보이도록 다시 구성한 버전입니다. 현재 Hero는 Header, Input Card, Astrolabe를 서로 다른 섹션으로 분리해 제목과 카드가 같은 Hero 컨테이너 안에서 겹치지 않도록 설계했습니다.

AI는 사주를 계산하지 않습니다. 프론트엔드의 사주 계산 엔진이 계산 JSON을 만들고, Google Apps Script가 Gemini API를 호출해 풀이만 생성합니다. API 키는 HTML, CSS, JavaScript에 넣지 않습니다.

## 주요 기능

- 출생년도/월/일, 양력/음력, 태어난 시간, 성별 기반 사주 분석
- V5 Beta RC는 실제 Apps Script API Mode 전용으로 동작
- 년주, 월주, 일주, 시주, 오행, 대운 흐름 표시
- 프리미엄 결과 카드, 오행 도넛 차트, 상세 풀이 아코디언
- 최근 본 사주 LocalStorage 저장
- 베타 기간에는 PDF, 공유 카드, 행운 아이템, AI 질문하기, 프리미엄, 궁합 기능 비활성화
- 관리자 페이지에서 Apps Script URL, 공지, 광고 문구, 모델명 설정
- AI 질문하기 비활성화 유지: `ENABLE_AI_CHAT=false`
- 행운 아이템, 공유 카드, PDF, 프리미엄, 궁합 비활성화 유지
- 사주 조회 1회당 Gemini 호출 1회 구조 유지

## V4.8 UI 레이어

첫 화면 배경은 9개 독립 레이어로 구성됩니다.

1. Deep Space Base
2. Nebula A
3. Nebula B
4. Nebula C
5. Constellation Lines
6. Cosmic Dust
7. Soft Glow
8. Astrolabe / 운명진
9. UI / Typography

Hero 구조는 `header.hero-header`, `section.hero-card`, `section.hero-wheel` 세 영역으로 분리됩니다. Header는 `padding-top: 120px`, `padding-bottom: 40px`, Card 영역은 `padding-top: 40px`, `padding-bottom: 120px`, Astrolabe 영역은 `margin-top: -80px` 기준입니다. 운명진은 카드와 별도 섹션에 있어 배경이 아니라 바닥에 깔린 천문도처럼 보이도록 조정했습니다.

## 아트 자산

```text
assets/art
├── astrolabe-circle.svg
├── constellation-map.svg
├── cosmic-noise.svg
├── destiny-portal.svg
├── golden-frame.svg
├── logo-symbol.svg
├── nebula-bg.svg
└── star-field.svg
```

- `logo-symbol.svg`: 원형 별/나침반/천문도 심볼
- `destiny-portal.svg`: 운명진, 로딩 종료 포털, Cosmic Gate reveal
- `nebula-bg.svg`: 성운 질감 보조 자산
- `star-field.svg`: 별/먼지 레이어
- `constellation-map.svg`: 별자리 선
- `cosmic-noise.svg`: 미세 우주 먼지
- `golden-frame.svg`: 카드 금장식
- `astrolabe-circle.svg`: 천문도 보조 원반

고서형 이미지 자산은 사용하지 않습니다.

## 결과 전환

결과 전환은 Cosmic Gate Reveal입니다.

- `.cosmic-gate-reveal`
- `.gate-line`
- `.gate-ring`
- `.gate-glow`
- `.gate-particles`

흐름은 얇은 금빛 세로선 등장, 원형 천문도 ring 등장, 중앙 광원 확산, 결과 카드 순차 reveal 순서입니다.

## 실행 방법

정적 사이트이므로 별도 빌드가 필요 없습니다.

1. `index.html`을 브라우저에서 엽니다.
2. 출생년도, 월, 일과 태어난 시간을 입력합니다.
3. `별빛으로 내 사주 읽기` 버튼을 누릅니다.
4. `APPS_SCRIPT_URL`이 비어 있거나 서버 연결에 실패하면 결과를 표시하지 않고 연결 오류 문구를 안내합니다.

## API Mode 연결

1. Google Apps Script에서 새 프로젝트를 만듭니다.
2. `apps-script-example.js` 내용을 `Code.gs`에 붙여 넣습니다.
3. Script Properties에 아래 값을 저장합니다.

```text
GEMINI_API_KEY=본인의 Gemini API 키
GEMINI_MODEL=gemini-2.5-flash
```

4. `Code.gs` 파일 전체 내용을 Apps Script 편집기의 `Code.gs` 최상위에 붙여넣습니다.
   `function myFunction() { ... }` 안에 넣으면 Web App이 `doGet/doPost`를 찾지 못합니다.
5. 웹 앱으로 새 버전을 배포합니다.
   - 실행 사용자: 나
   - 액세스 권한: 모든 사용자
6. `/exec` 주소에 접속했을 때 JSON이 출력되는지 확인합니다.
7. `src/services/config.js`의 `APPS_SCRIPT_URL`에 배포 URL을 넣습니다.

```js
APPS_SCRIPT_URL: "https://script.google.com/macros/s/배포_ID/exec"
```

V5 Beta RC에서는 `USE_MOCK_WHEN_API_EMPTY=false`가 기본값입니다. 베타 테스트 전에 Apps Script Web App URL과 Script Properties의 `GEMINI_API_KEY`가 반드시 준비되어 있어야 합니다.

## GitHub Pages 배포

1. GitHub 저장소를 만듭니다.
2. 프로젝트 파일을 저장소 루트에 업로드합니다.
3. GitHub `Settings` > `Pages`로 이동합니다.
4. Source를 `Deploy from a branch`로 선택합니다.
5. Branch는 `main`, 폴더는 `/root`로 선택합니다.
6. 배포 후 `robots.txt`, `sitemap.xml`, canonical URL을 실제 Pages 주소로 수정합니다.

## 성능 메모

- Three.js와 영상 배경은 사용하지 않습니다.
- SVG/CSS/Canvas 중심으로 구성합니다.
- 로딩 Canvas는 종료 시 `requestAnimationFrame`과 `resize` 이벤트를 정리합니다.
- `prefers-reduced-motion` 사용자는 주요 애니메이션이 줄어듭니다.

## 보안 주의

- Gemini API 키를 프론트엔드 파일에 넣지 마세요.
- `.env` 파일이나 API 키가 포함된 파일을 GitHub에 올리지 마세요.
- Apps Script URL은 공개되어도 되지만, API 키는 Script Properties에서만 관리하세요.

## ZIP 생성

배포용 ZIP 파일명은 `ai-saju-webapp.zip`입니다. `node_modules`, `.git`, `.env` 계열 파일은 포함하지 않습니다.
