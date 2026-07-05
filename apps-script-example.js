/**
 * AI 사주 플랫폼 V2 - Google Apps Script Proxy Server
 *
 * 역할:
 * - 프론트엔드에서 받은 사주 계산 JSON을 Gemini에 전달합니다.
 * - Gemini API 키는 Script Properties에서만 읽습니다.
 * - Apps Script는 API Proxy이며, 사주 계산을 절대 수행하지 않습니다.
 *
 * Script Properties:
 * - GEMINI_API_KEY: 필수
 * - GEMINI_MODEL: 선택, 기본값 gemini-2.5-flash
 */

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const CACHE_TTL_SECONDS = 21600;

function doPost(e) {
  try {
    const request = parseRequestBody(e);

    if (request.type === "fortune") {
      return jsonResponse(handleFortune(request));
    }

    if (request.type === "question") {
      return jsonResponse(handleQuestion(request));
    }

    return jsonResponse({
      error: true,
      message: "지원하지 않는 요청 타입입니다.",
    });
  } catch (error) {
    return jsonResponse({
      error: true,
      message: error.message || "알 수 없는 오류가 발생했습니다.",
    });
  }
}

function doGet() {
  return jsonResponse({
    ok: true,
    service: "AI Saju Apps Script Proxy",
  });
}

function doOptions() {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("요청 본문이 비어 있습니다.");
  }

  return JSON.parse(e.postData.contents);
}

function handleFortune(request) {
  const payload = request.payload || {};
  const saju = payload.saju;
  const birthData = payload.birthData || {};

  if (!saju || !saju.yearPillar || !saju.fiveElements) {
    throw new Error("사주 계산 JSON이 없습니다. 프론트 계산 엔진 결과를 먼저 전달해야 합니다.");
  }

  const sessionId = createSessionId(birthData, saju);
  const cache = CacheService.getScriptCache();
  const cacheKey = "fortune:" + sessionId;
  const cached = cache.get(cacheKey);

  if (cached) {
    const cachedResult = JSON.parse(cached);
    cachedResult.sessionId = sessionId;
    cachedResult.meta = cachedResult.meta || {};
    cachedResult.meta.cached = true;
    return cachedResult;
  }

  const prompt = buildFortunePrompt({
    birthData: birthData,
    saju: saju,
    settings: request.settings || {},
  });
  const model = chooseModel(request.settings && request.settings.model);
  const result = normalizeFortuneResult(callGeminiJson(prompt, model));

  result.sessionId = sessionId;
  result.meta = result.meta || {};
  result.meta.cached = false;
  result.meta.model = model;

  cache.put(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS);
  cache.put(
    "context:" + sessionId,
    JSON.stringify({
      birthData: birthData,
      saju: saju,
      analysis: result,
    }),
    CACHE_TTL_SECONDS,
  );

  return result;
}

function handleQuestion(request) {
  const payload = request.payload || {};
  const sessionId = request.sessionId || createSessionId(payload.birthData, payload.saju);
  const cachedContext = CacheService.getScriptCache().get("context:" + sessionId);
  const context = cachedContext ? JSON.parse(cachedContext) : payload;

  if (!context.saju || !context.analysis) {
    throw new Error("질문 답변에 필요한 기존 사주 JSON과 분석 결과가 없습니다.");
  }

  if (!payload.question) {
    throw new Error("질문이 비어 있습니다.");
  }

  const prompt = buildQuestionPrompt({
    question: payload.question,
    history: payload.history || [],
    birthData: context.birthData || payload.birthData || {},
    saju: context.saju,
    analysis: context.analysis,
    settings: request.settings || {},
  });
  const model = chooseModel(request.settings && request.settings.model);
  const answerJson = callGeminiJson(prompt, model);

  return {
    sessionId: sessionId,
    answer: answerJson.answer || "답변을 생성하지 못했습니다.",
    meta: {
      model: model,
      cachedSaju: true,
    },
  };
}

function callGeminiJson(prompt, model) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");

  if (!apiKey) {
    throw new Error("Script Properties에 GEMINI_API_KEY가 없습니다.");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.62,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("Gemini API 오류: " + body);
  }

  const data = JSON.parse(body);
  const text =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;

  if (!text) {
    throw new Error("Gemini 응답에서 텍스트를 찾지 못했습니다.");
  }

  return JSON.parse(cleanJsonText(text));
}

function buildFortunePrompt(context) {
  const promptLines = [];
  const birthData = context.birthData;
  const saju = context.saju;
  const settings = context.settings || {};

  promptLines.push("너는 30년 이상 경력의 명리학 전문가이자 상담 전문가이자 심리상담사다.");
  promptLines.push("너의 임무는 사주를 계산하는 것이 아니라, 이미 계산된 사주 JSON을 해석하는 것이다.");
  promptLines.push("절대 생년월일을 다시 계산하지 않는다.");
  promptLines.push("절대 년주, 월주, 일주, 시주를 새로 추정하지 않는다.");
  promptLines.push("프론트엔드 사주 계산 엔진이 만든 JSON을 유일한 계산 근거로 사용한다.");
  promptLines.push("출력은 반드시 JSON 객체 하나만 반환한다.");
  promptLines.push("Markdown, 코드블록, 설명문, 머리말, 꼬리말을 절대 출력하지 않는다.");
  promptLines.push("과장, 단정, 공포 조장, 희망고문을 금지한다.");
  promptLines.push("건강 항목은 의학적 진단처럼 쓰지 않는다.");
  promptLines.push("재물과 투자 항목은 확정 수익처럼 말하지 않는다.");
  promptLines.push("결혼과 연애 항목은 상대의 의사를 단정하지 않는다.");
  promptLines.push("현실적인 해결책과 행동 지침을 포함한다.");
  promptLines.push("상담 문장은 따뜻하지만 지나치게 미신적으로 쓰지 않는다.");
  promptLines.push("사용자가 실제 명리학자에게 상담받는 느낌을 받도록 구체적으로 작성한다.");
  promptLines.push("모든 사용자에게 비슷하게 보이는 일반 운세 문구를 반복하지 않는다.");
  promptLines.push("이름, 성별, 양력/음력, 생년월일, 태어난 시간, 년주, 월주, 일주, 시주를 문장에 자연스럽게 반영한다.");
  promptLines.push("오행 비율에서 가장 강한 오행과 가장 약한 오행을 반드시 분석의 중심축으로 사용한다.");
  promptLines.push("십성, 음양, 지장간, 용신, 희신, 대운, 세운이 있으면 각 항목의 근거로 활용한다.");
  promptLines.push("올해운은 사주 JSON의 yearFortune.year와 yearFortune.pillar를 기준으로 구체적으로 작성한다.");
  promptLines.push("직업운, 재물운, 대인관계, 건강운, 애정운은 서로 다른 관점과 행동 조언을 담아 작성한다.");
  promptLines.push("좋은 행동은 정확히 3가지 이상, 주의할 행동은 정확히 3가지 이상 포함한다.");
  promptLines.push("사용자의 사주 데이터에 없는 사건, 질병, 결혼 시기, 수익 규모를 만들어내지 않는다.");
  promptLines.push("일반 운세처럼 '좋은 일이 생깁니다' 수준으로 쓰지 말고, 년주·월주·일주·오행·세운 중 어떤 근거로 해석했는지 짧게 드러낸다.");
  promptLines.push("예: '월지와 세운의 흐름상 직업 변화의 기운이 강하게 들어오는 시기입니다'처럼 사주 구조가 문장 안에 보여야 한다.");
  if (saju.hourUnknown) {
    promptLines.push("중요: 태어난 시간이 확인되지 않아 시주를 제외한 년주, 월주, 일주를 중심으로 분석한다.");
    promptLines.push("시주를 임의로 만들거나 추정하지 않는다.");
    promptLines.push("결과 초반에 '태어난 시간이 확인되지 않아 시주를 제외한 년주, 월주, 일주를 중심으로 분석했습니다. 따라서 일부 세부 운세는 실제 시주에 따라 달라질 수 있습니다.'라는 취지의 안내를 작게 반영한다.");
  }
  promptLines.push("전체 분량은 한국어 기준 2200자에서 3200자 사이를 목표로 한다.");
  promptLines.push("각 섹션은 2문장 이상 작성한다.");
  promptLines.push("점수는 0에서 100 사이 정수로 작성한다.");
  promptLines.push("점수는 지나치게 모두 높게 주지 않고 항목 간 차이를 둔다.");
  promptLines.push("luckyItems는 광고처럼 보이지 않게 AI 추천 형태로 작성한다.");
  promptLines.push("luckyItems url은 모르면 #을 사용한다.");
  promptLines.push("아래 입력 데이터만 사용한다.");
  promptLines.push("사용자 입력:");
  promptLines.push(JSON.stringify(birthData));
  promptLines.push("사주 계산 엔진 JSON:");
  promptLines.push(JSON.stringify(saju));
  promptLines.push("운영자 추가 메모:");
  promptLines.push(settings.promptMemo || "없음");
  promptLines.push("응답 스키마:");
  promptLines.push("{");
  promptLines.push('"totalScore": 92,');
  promptLines.push('"scores": { "money": 88, "career": 94, "health": 76, "love": 81, "relationship": 85 },');
  promptLines.push('"summary": "AI 한줄 총평",');
  promptLines.push('"sections": {');
  promptLines.push('"personality": "...",');
  promptLines.push('"earlyLife": "...",');
  promptLines.push('"middleLife": "...",');
  promptLines.push('"lateLife": "...",');
  promptLines.push('"yearFortune": "...",');
  promptLines.push('"money": "...",');
  promptLines.push('"career": "...",');
  promptLines.push('"business": "...",');
  promptLines.push('"jobChange": "...",');
  promptLines.push('"love": "...",');
  promptLines.push('"marriage": "...",');
  promptLines.push('"health": "...",');
  promptLines.push('"relationship": "...",');
  promptLines.push('"goodActions": "...",');
  promptLines.push('"cautions": "...",');
  promptLines.push('"luckyColor": "...",');
  promptLines.push('"luckyNumber": "...",');
  promptLines.push('"luckyDirection": "..."');
  promptLines.push("},");
  promptLines.push('"luckyItems": [ { "title": "...", "description": "...", "url": "#" } ]');
  promptLines.push("}");

  addCounselingPrinciples(promptLines);
  addSectionGuide(promptLines);
  addQualityChecklist(promptLines);

  return promptLines.join("\n");
}

function addCounselingPrinciples(lines) {
  const principles = [
    "상담 원칙 001: 계산값이 애매하면 새로 계산하지 말고 주어진 JSON 안에서만 해석한다.",
    "상담 원칙 002: 년주는 사회적 배경과 초년 환경을 설명하는 참고축으로 사용한다.",
    "상담 원칙 003: 월주는 성장 환경과 사회적 역할의 기반으로 설명한다.",
    "상담 원칙 004: 일주는 사용자의 중심 기질과 판단 방식으로 설명한다.",
    "상담 원칙 005: 시주는 후반 흐름과 내면 욕구를 설명하되 시간이 미상이라면 단정하지 않는다.",
    "상담 원칙 006: 오행 비율은 강약과 균형을 설명하는 핵심 자료로 사용한다.",
    "상담 원칙 007: 강한 오행은 장점과 과잉 리스크를 함께 설명한다.",
    "상담 원칙 008: 약한 오행은 결핍으로 몰아가지 말고 보완 행동을 제안한다.",
    "상담 원칙 009: 용신과 희신은 균형을 돕는 상징으로 설명한다.",
    "상담 원칙 010: 십성은 관계, 일, 돈, 표현 방식의 힌트로 사용한다.",
    "상담 원칙 011: 지장간은 숨은 성향이나 잠재력으로 부드럽게 해석한다.",
    "상담 원칙 012: 12운성은 에너지의 단계로 설명한다.",
    "상담 원칙 013: 12신살은 겁을 주는 표현 대신 주의할 패턴으로 설명한다.",
    "상담 원칙 014: 대운은 장기 흐름으로 설명하고 특정 사건을 단정하지 않는다.",
    "상담 원칙 015: 세운은 올해의 분위기와 선택 기준으로 설명한다.",
    "상담 원칙 016: 사용자의 이름이 있으면 자연스럽게 호칭에 반영한다.",
    "상담 원칙 017: 성별이 선택 안함이면 성별 고정 해석을 피한다.",
    "상담 원칙 018: 음력 입력에 대한 메모가 있으면 계산 엔진의 note를 존중한다.",
    "상담 원칙 019: 모든 조언은 스스로 선택할 여지를 남긴다.",
    "상담 원칙 020: 불안보다 실행 가능한 정리를 우선한다.",
    "상담 원칙 021: 행운의 색은 오행 보완과 분위기를 함께 고려한다.",
    "상담 원칙 022: 행운의 숫자는 상징으로 제안하고 절대적 효과로 말하지 않는다.",
    "상담 원칙 023: 행운의 방향은 일상 활용 팁으로만 설명한다.",
    "상담 원칙 024: 재물운은 수입, 지출, 리스크 관리로 나누어 설명한다.",
    "상담 원칙 025: 직업운은 역할, 역량, 조직 내 평가로 나누어 설명한다.",
    "상담 원칙 026: 사업운은 검증, 고객, 비용 구조로 나누어 설명한다.",
    "상담 원칙 027: 이직운은 조건표와 준비 기간을 제안한다.",
    "상담 원칙 028: 애정운은 소통 방식과 관계 리듬을 설명한다.",
    "상담 원칙 029: 결혼운은 현실 대화와 생활 기준을 강조한다.",
    "상담 원칙 030: 건강운은 생활 습관과 휴식 중심으로 설명한다.",
    "상담 원칙 031: 대인관계는 경계, 신뢰, 말의 온도로 설명한다.",
    "상담 원칙 032: 좋은 행동은 오늘 바로 할 수 있는 행동으로 쓴다.",
    "상담 원칙 033: 주의사항은 피해야 할 행동과 대안을 함께 쓴다.",
    "상담 원칙 034: 문장은 너무 짧게 끊지 말고 상담 흐름을 유지한다.",
    "상담 원칙 035: 한 문단 안에서 장점과 주의점을 균형 있게 둔다.",
    "상담 원칙 036: 사용자를 평가하거나 낙인찍는 표현을 피한다.",
    "상담 원칙 037: '반드시', '무조건', '큰일 난다' 같은 표현을 피한다.",
    "상담 원칙 038: '가능성이 있습니다', '흐름으로 보입니다' 같은 신중한 표현을 사용한다.",
    "상담 원칙 039: 종교적 단정이나 초자연적 확언을 피한다.",
    "상담 원칙 040: 플랫폼 신뢰도를 위해 차분하고 전문적인 어휘를 사용한다.",
    "상담 원칙 041: summary에는 일주, 올해 세운, 가장 강한 운 중 최소 두 가지를 반영한다.",
    "상담 원칙 042: personality에는 일주와 오행 강약을 반드시 언급한다.",
    "상담 원칙 043: yearFortune에는 현재 연도와 세운 기둥을 반드시 언급한다.",
    "상담 원칙 044: money, career, love, health, relationship은 같은 문장 구조를 반복하지 않는다.",
    "상담 원칙 045: 좋은 행동과 주의사항은 추상어보다 실제 행동으로 쓴다.",
    "상담 원칙 046: 태어난 시간이 미상일 경우 시주 관련 해석을 보수적으로 쓴다.",
    "상담 원칙 047: 성별 선택값은 고정 관념이 아니라 상담 톤과 관계 해석의 맥락으로만 사용한다.",
    "상담 원칙 048: luckyItems는 부족한 오행이나 올해 강한 운과 연결된 추천 이유를 포함한다.",
    "상담 원칙 049: 점수는 사주 구조와 섹션 내용이 서로 납득되도록 차이를 둔다.",
    "상담 원칙 050: 이전 예시 문구를 그대로 베끼지 말고 입력 데이터에 맞게 새로 쓴다.",
    "상담 원칙 051: hourUnknown이 true이면 시주, 후반 흐름, 자녀운, 말년 세부 해석을 단정하지 않는다.",
    "상담 원칙 052: hourUnknown이 true여도 성격, 오행, 종합운, 직업운, 재물운, 애정운, 건강운, 올해운은 정상 분석한다.",
    "상담 원칙 053: 각 주요 운세는 최소 하나 이상의 계산 근거를 짧게 포함한다.",
    "상담 원칙 054: 결과가 이름만 바뀐 것처럼 보이지 않도록 오행 비율과 기둥 조합을 구체적으로 반영한다.",
  ];

  Array.prototype.push.apply(lines, principles);
}

function addSectionGuide(lines) {
  const sections = [
    ["personality", "성격"],
    ["earlyLife", "초년운"],
    ["middleLife", "중년운"],
    ["lateLife", "말년운"],
    ["yearFortune", "올해운"],
    ["money", "재물운"],
    ["career", "직업운"],
    ["business", "사업운"],
    ["jobChange", "이직운"],
    ["love", "애정운"],
    ["marriage", "결혼운"],
    ["health", "건강운"],
    ["relationship", "대인관계"],
    ["goodActions", "좋은 행동"],
    ["cautions", "주의사항"],
    ["luckyColor", "행운의 색"],
    ["luckyNumber", "행운의 숫자"],
    ["luckyDirection", "행운의 방향"],
  ];

  sections.forEach(function (section, index) {
    const key = section[0];
    const label = section[1];
    lines.push("섹션 지침 " + pad(index + 1) + "-01: " + key + "는 " + label + " 항목이다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-02: 계산 JSON의 기둥과 오행을 근거로 작성한다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-03: 단정 대신 경향과 가능성 중심으로 설명한다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-04: 사용자에게 실천 가능한 조언을 포함한다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-05: 장점만 쓰지 말고 주의점도 함께 쓴다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-06: 불안감을 키우는 표현을 쓰지 않는다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-07: 다른 섹션과 내용이 지나치게 중복되지 않게 한다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-08: 프리미엄 상담처럼 구체적인 언어를 사용한다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-09: 최소 두 문장 이상으로 작성한다.");
    lines.push("섹션 지침 " + pad(index + 1) + "-10: JSON 문자열 안에 줄바꿈이 필요하면 \\n을 사용한다.");
  });
}

function addQualityChecklist(lines) {
  for (var i = 1; i <= 90; i += 1) {
    lines.push(
      "최종 검수 " +
        pad(i) +
        ": JSON 형식, 키 이름, 점수 범위, 상담 톤, 계산 금지 원칙을 다시 확인한다.",
    );
  }
}

function buildQuestionPrompt(context) {
  return [
    "너는 30년 이상 경력의 명리학 전문가이자 상담 전문가다.",
    "이미 계산된 사주 JSON과 기존 분석 결과를 바탕으로 사용자의 추가 질문에 답한다.",
    "사주를 다시 계산하지 않는다.",
    "년주, 월주, 일주, 시주를 새로 추정하지 않는다.",
    "답변은 현실적이고 균형 있게 작성한다.",
    "출력은 반드시 JSON 객체 하나만 반환한다.",
    "Markdown을 쓰지 않는다.",
    "응답 스키마는 { \"answer\": \"...\" } 이다.",
    "사용자 질문:",
    context.question,
    "대화 기록:",
    JSON.stringify(context.history || []),
    "사용자 입력:",
    JSON.stringify(context.birthData || {}),
    "사주 계산 JSON:",
    JSON.stringify(context.saju),
    "기존 분석 결과:",
    JSON.stringify(context.analysis),
    "운영자 추가 메모:",
    (context.settings && context.settings.promptMemo) || "없음",
    "답변 지침:",
    "질문에 직접 답한다.",
    "가능하면 5문장 이내로 답한다.",
    "이직, 창업, 결혼, 투자 질문은 장점과 리스크를 모두 말한다.",
    "의학, 법률, 금융 판단은 전문가 상담을 권한다.",
    "공포를 조장하지 않는다.",
    "행동 기준을 1개 이상 제안한다.",
  ].join("\n");
}

function normalizeFortuneResult(parsed) {
  return {
    totalScore: clampScore(parsed.totalScore),
    scores: {
      money: clampScore(parsed.scores && parsed.scores.money),
      career: clampScore(parsed.scores && parsed.scores.career),
      health: clampScore(parsed.scores && parsed.scores.health),
      love: clampScore(parsed.scores && parsed.scores.love),
      relationship: clampScore(parsed.scores && parsed.scores.relationship),
    },
    summary: parsed.summary || "",
    sections: parsed.sections || {},
    luckyItems: Array.isArray(parsed.luckyItems) ? parsed.luckyItems : [],
    meta: parsed.meta || {},
  };
}

function chooseModel(requestedModel) {
  const propertyModel =
    PropertiesService.getScriptProperties().getProperty("GEMINI_MODEL") ||
    DEFAULT_GEMINI_MODEL;
  const model = requestedModel || propertyModel;
  const allowed = ["gemini-2.5-flash"];

  return allowed.indexOf(model) >= 0 ? model : DEFAULT_GEMINI_MODEL;
}

function createSessionId(birthData, saju) {
  const raw = JSON.stringify({
    birthData: birthData || {},
    saju: saju || {},
  });
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);

  return digest
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ("0" + value.toString(16)).slice(-2);
    })
    .join("")
    .slice(0, 24);
}

function cleanJsonText(text) {
  return String(text)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
}

function clampScore(value) {
  const number = Number(value);
  if (isNaN(number)) return 70;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function pad(value) {
  return String(value).padStart(3, "0");
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
