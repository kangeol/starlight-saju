/**
 * Gemini 직접 호출 파일이 아닙니다.
 * 프론트엔드는 Google Apps Script URL로만 요청하고, Apps Script가 Gemini API를 호출합니다.
 */
(function () {
  const BUSY_RETRY_MESSAGE = "AI 분석 요청이 많아 다시 시도하고 있습니다...";
  const FINAL_BUSY_MESSAGE = "현재 AI 분석 요청이 많습니다. 잠시 후 다시 시도해주세요.";
  const RETRY_DELAYS_MS = [1000];
  const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];
  const API_ERROR_MESSAGE = "현재 AI 분석 서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
  const REQUIRED_SCORE_KEYS = ["money", "career", "health", "love", "relationship"];
  const REQUIRED_SECTION_KEYS = [
    "personality",
    "earlyLife",
    "middleLife",
    "lateLife",
    "yearFortune",
    "money",
    "career",
    "love",
    "health",
    "relationship",
    "goodActions",
    "cautions",
  ];

  function getConfig() {
    return window.AppConfig.getRuntimeConfig();
  }

  async function requestFortune({ birthData, saju, onRetry }) {
    const config = getConfig();

    if (!config.APPS_SCRIPT_URL) {
      throw new Error(API_ERROR_MESSAGE);
    }

    try {
      const response = await postToProxyWithRetry(
        {
          type: "fortune",
          payload: {
            birthData,
            saju,
          },
          settings: {
            model: config.DEFAULT_MODEL,
            promptMemo: config.promptMemo,
          },
        },
        {
          onRetry,
        },
      );

      return normalizeAnalysis(response, birthData, saju);
    } catch (error) {
      if (shouldRetry(error)) {
        return buildClientDefaultAnalysis(birthData, saju, error);
      }

      throw error;
    }
  }

  async function askQuestion({ session, question }) {
    const config = getConfig();

    if (!config.APPS_SCRIPT_URL) {
      throw new Error(API_ERROR_MESSAGE);
    }

    const response = await postToProxy({
      type: "question",
      sessionId: session.id,
      payload: {
        question,
        birthData: session.birthData,
        saju: session.saju,
        analysis: session.analysis,
        history: session.chat || [],
      },
      settings: {
        model: config.DEFAULT_MODEL,
        promptMemo: config.promptMemo,
      },
    });

    return {
      answer:
        response.answer ||
        API_ERROR_MESSAGE,
    };
  }

  async function postToProxy(body) {
    const config = getConfig();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), config.API_TIMEOUT_MS);
    const payload = JSON.stringify(body);

    try {
      const response = await fetch(config.APPS_SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
        // Apps Script Web App은 OPTIONS preflight를 안정적으로 처리하지 못할 수 있습니다.
        // application/json 헤더를 직접 넣지 않고 text/plain simple request로 전송합니다.
        // Apps Script doPost에서는 JSON.parse(e.postData.contents)로 이 문자열을 파싱합니다.
        body: payload,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(API_ERROR_MESSAGE);
      }

      let data;
      try {
        data = await response.json();
      } catch (error) {
        throw new Error(API_ERROR_MESSAGE);
      }

      if (data.debug) {
        throw createDebugError(data);
      }

      if (data.error || data.ok === false) {
        throw new Error(data.userMessage || data.message || API_ERROR_MESSAGE);
      }

      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(API_ERROR_MESSAGE);
      }

      throw error.message ? error : new Error(API_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function postToProxyWithRetry(body, options = {}) {
    const config = getConfig();
    const payload = JSON.stringify(body);
    let lastError = null;
    const startedAt = Date.now();
    const maxTotalMs = Number(config.API_TIMEOUT_MS || 10000);

    for (let attemptIndex = 0; attemptIndex <= RETRY_DELAYS_MS.length; attemptIndex += 1) {
      const remainingMs = maxTotalMs - (Date.now() - startedAt);
      if (remainingMs <= 250) {
        const deadlineError = new Error(FINAL_BUSY_MESSAGE);
        deadlineError.retryable = true;
        throw deadlineError;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), remainingMs);

      try {
        const response = await fetch(config.APPS_SCRIPT_URL, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          redirect: "follow",
          body: payload,
          signal: controller.signal,
        });

        const data = await parseProxyResponse(response);

        if (data.debug) {
          throw createDebugError(data);
        }

        if (!response.ok || data.error || data.ok === false) {
          throw createProxyError(data, response.status);
        }

        return data;
      } catch (error) {
        lastError = normalizeRequestError(error);

        if (shouldRetry(lastError) && attemptIndex < RETRY_DELAYS_MS.length) {
          const delayMs = RETRY_DELAYS_MS[attemptIndex];
          const canRetryWithinDeadline = Date.now() - startedAt + delayMs < maxTotalMs - 250;

          if (!canRetryWithinDeadline) {
            const deadlineError = new Error(FINAL_BUSY_MESSAGE);
            deadlineError.retryable = true;
            deadlineError.status = lastError.status || lastError.geminiStatus || 0;
            throw deadlineError;
          }

          if (typeof options.onRetry === "function") {
            options.onRetry({
              attempt: attemptIndex + 1,
              delayMs,
              message: BUSY_RETRY_MESSAGE,
            });
          }

          await wait(delayMs);
          continue;
        }

        if (shouldRetry(lastError)) {
          const finalError = new Error(FINAL_BUSY_MESSAGE);
          finalError.retryable = true;
          finalError.status = lastError.status || lastError.geminiStatus || 0;
          throw finalError;
        }

        throw lastError;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    if (shouldRetry(lastError)) {
      const finalError = new Error(FINAL_BUSY_MESSAGE);
      finalError.retryable = true;
      finalError.status = lastError.status || lastError.geminiStatus || 0;
      throw finalError;
    }

    throw lastError || new Error(API_ERROR_MESSAGE);
  }

  async function parseProxyResponse(response) {
    try {
      return await response.json();
    } catch (error) {
      const parseError = new Error(API_ERROR_MESSAGE);
      parseError.retryable = !response.ok || response.status >= 500;
      parseError.status = response.status;
      throw parseError;
    }
  }

  function createProxyError(data, status) {
    const error = new Error(data?.userMessage || data?.message || API_ERROR_MESSAGE);
    error.retryable = Boolean(data?.retryable) || RETRYABLE_STATUS_CODES.includes(Number(data?.geminiStatus || status));
    error.status = Number(data?.geminiStatus || status || 0);
    error.detail = data?.detail || null;
    return error;
  }

  function normalizeRequestError(error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(FINAL_BUSY_MESSAGE);
      timeoutError.retryable = true;
      return timeoutError;
    }

    if (!error.message || error.message === "Failed to fetch") {
      const networkError = new Error(FINAL_BUSY_MESSAGE);
      networkError.retryable = true;
      return networkError;
    }

    return error;
  }

  function shouldRetry(error) {
    if (!error) return false;
    if (error.retryable) return true;
    return RETRYABLE_STATUS_CODES.includes(Number(error.status || error.geminiStatus));
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function normalizeAnalysis(data, birthData, saju) {
    validateAnalysisResponse(data);
    const scores = data.scores;

    return {
      sessionId: data.sessionId || window.SajuUtils.createId("session"),
      totalScore: clampScore(data.totalScore),
      scores: {
        money: clampScore(scores.money),
        career: clampScore(scores.career),
        health: clampScore(scores.health),
        love: clampScore(scores.love),
        relationship: clampScore(scores.relationship),
      },
      summary: data.summary,
      todayInsight: data.todayInsight || data.coreMessage || "",
      coreMessage: data.coreMessage || data.todayInsight || "",
      analysisBasis: data.analysisBasis || null,
      coreInsight: Array.isArray(data.coreInsight) ? data.coreInsight : [],
      goodActions: Array.isArray(data.goodActions) ? data.goodActions : [],
      avoidActions: Array.isArray(data.avoidActions) ? data.avoidActions : [],
      sections: data.sections,
      luckyItems: Array.isArray(data.luckyItems) ? data.luckyItems : [],
      meta: {
        ...(data.meta || {}),
        mode: "api",
        apiCalls: 1,
      },
    };
  }

  function createDebugError(data) {
    if (data.responseText) {
      console.log("Gemini responseText", data.responseText);
    }

    const debugPayload = {
      message: data.message || "",
      detail: data.detail || null,
      geminiStatus: data.geminiStatus || null,
      geminiResponse: data.geminiResponse
        ? String(data.geminiResponse).slice(0, 500)
        : null,
      responseText: data.responseText || null,
      stack: data.stack || "",
    };

    console.error("AI SAJU DEBUG ERROR", debugPayload);

    const status = Number(debugPayload.geminiStatus || 0);
    const retryable = RETRYABLE_STATUS_CODES.includes(status);
    const error = new Error(retryable ? FINAL_BUSY_MESSAGE : API_ERROR_MESSAGE);
    error.debug = debugPayload;
    error.status = status;
    error.retryable = retryable;
    return error;
  }

  function validateAnalysisResponse(data) {
    if (!data || typeof data !== "object") throw new Error(API_ERROR_MESSAGE);
    if (!Number.isFinite(Number(data.totalScore))) throw new Error(API_ERROR_MESSAGE);
    if (!data.summary || typeof data.summary !== "string") throw new Error(API_ERROR_MESSAGE);
    if (!data.scores || typeof data.scores !== "object") throw new Error(API_ERROR_MESSAGE);
    if (!data.analysisBasis || typeof data.analysisBasis !== "object") throw new Error(API_ERROR_MESSAGE);
    if (!data.sections || typeof data.sections !== "object") throw new Error(API_ERROR_MESSAGE);

    REQUIRED_SCORE_KEYS.forEach((key) => {
      if (!Number.isFinite(Number(data.scores[key]))) throw new Error(API_ERROR_MESSAGE);
    });

    REQUIRED_SECTION_KEYS.forEach((key) => {
      if (!data.sections[key] || typeof data.sections[key] !== "string") {
        throw new Error(API_ERROR_MESSAGE);
      }
    });
  }

  function buildClientDefaultAnalysis(birthData, saju, error) {
    const ratio = normalizeFiveElements(saju.fiveElements);
    const profile = getElementProfile(ratio);
    const scores = buildDefaultScores(ratio);
    const pillars = {
      year: saju.yearPillar || "",
      month: saju.monthPillar || "",
      day: saju.dayPillar || "",
      hour: saju.hourUnknown ? "시간 모름" : saju.hourPillarLabel || saju.hourPillar || "",
    };
    const goodActions = getDefaultGoodActions(profile.weakest);
    const avoidActions = getDefaultAvoidActions(profile.strongest);
    const lucky = getDefaultLucky(profile.weakest, birthData, saju);
    const year = saju.yearFortune?.year || new Date().getFullYear();
    const yearPillar = saju.yearFortune?.pillar || String(year);
    const summary = buildDefaultSummary(profile, year, yearPillar);
    const todayInsight = buildTodayInsight(profile, birthData, saju);

    return {
      sessionId: window.SajuUtils.simpleHash({ birthData, saju, version: "v7-client-basic" }),
      totalScore: scores.total,
      scores,
      summary,
      todayInsight,
      coreMessage: todayInsight,
      analysisBasis: {
        pillars,
        fiveElements: ratio,
        keyInsights: [
          `년주 ${pillars.year}, 월주 ${pillars.month}, 일주 ${pillars.day}, 시주 ${pillars.hour} 기준으로 분석했습니다.`,
          `${profile.strongestLabel} 기운이 강하고 ${profile.weakestLabel} 기운 보완이 필요합니다.`,
          `${year}년 ${yearPillar} 세운을 기준으로 올해 흐름을 보았습니다.`,
        ],
      },
      coreInsight: [
        todayInsight,
        `${profile.strongestLabel} 기운은 강점으로 쓰고 ${profile.weakestLabel} 기운은 생활 습관으로 보완하는 구조입니다.`,
        "직업, 재물, 애정, 건강, 대인관계는 서로 다른 기준으로 분리해 보았습니다.",
      ],
      goodActions,
      avoidActions,
      sections: {
        personality: limitText(`일주 ${pillars.day}와 오행 흐름을 함께 보면 ${profile.strongestLabel} 기운이 먼저 드러나는 편입니다. 다만 ${profile.weakestLabel} 기운이 약해지는 시기에는 판단의 균형이 흔들릴 수 있어 생활 속 보완이 중요합니다.`, 220),
        earlyLife: `초년운은 년주 ${pillars.year}와 전체 오행 균형을 함께 봅니다. 주변 환경의 영향을 받되 자신의 강한 기운을 어떻게 쓰는지가 중요합니다.`,
        middleLife: `중년운은 월주 ${pillars.month}와 직업적 책임의 흐름을 중심으로 봅니다. 역할을 넓히기보다 기준을 세우고 성과를 누적하는 방식이 안정적입니다.`,
        lateLife: `말년운은 부족한 ${profile.weakestLabel} 기운을 얼마나 꾸준히 보완했는지에 따라 안정감이 달라집니다.`,
        yearFortune: limitText(`${year}년 ${yearPillar} 흐름에서는 빠른 변화보다 기준을 세우고 반복 가능한 선택을 만드는 것이 좋습니다. 무리한 확장보다 이미 잡힌 일의 방향을 정리하는 쪽이 안정적입니다.`, 220),
        money: limitText("재물운은 재성 흐름과 오행 균형을 함께 봅니다. 큰 수익을 급히 좇기보다 지출 구조, 현금 흐름, 회수 시점을 먼저 정리하는 편이 안정적입니다.", 220),
        career: limitText("직업운은 관성, 식상, 일간 구조를 기준으로 봅니다. 책임이 분명한 일, 결과물을 보여줄 수 있는 일, 개선이 필요한 일을 차분히 정리할 때 강점이 살아납니다.", 220),
        business: "사업운은 확장보다 반복 매출과 비용 통제 구조가 먼저입니다. 작은 검증을 거친 뒤 넓히는 방식이 좋습니다.",
        jobChange: "이직운은 감정적인 이동보다 역할, 보상, 성장 가능성을 문서로 비교할 때 유리합니다.",
        love: limitText("애정운은 일지와 배우자궁을 기준으로 봅니다. 관계에서는 감정의 속도보다 약속, 생활 리듬, 말의 온도를 맞추는 태도가 중요합니다.", 220),
        marriage: "결혼운은 생활 기준이 맞는지 확인하는 과정이 중요합니다. 급한 결정은 피하고 현실 조건을 함께 조율하는 편이 좋습니다.",
        health: limitText(`건강운은 오행 과다와 부족을 함께 봅니다. ${profile.strongestLabel} 기운이 과열되지 않게 하고 ${profile.weakestLabel} 기운을 보완하는 수면, 식사, 휴식 리듬이 필요합니다.`, 220),
        relationship: limitText("대인관계는 비겁, 인성, 식상의 흐름을 나누어 봅니다. 경쟁 구도에서는 역할을 분명히 하고, 가까운 관계에서는 설명을 생략하지 않는 태도가 좋습니다.", 220),
        goodActions: goodActions.join("\n"),
        cautions: avoidActions.join("\n"),
        luckyColor: lucky.color,
        luckyNumber: lucky.number,
        luckyDirection: lucky.direction,
      },
      luckyItems: [
        {
          title: `${profile.weakestLabel} 기운을 보완하는 상징 아이템`,
          description: "부족한 기운을 생활 속에서 의식적으로 보완하기 위한 추천입니다.",
          url: "#",
        },
      ],
      meta: {
        mode: "engine-basic",
        apiCalls: 0,
        defaultResult: true,
        fallbackReason: error?.message || "",
        engineVersion: "v7-client-basic",
      },
    };
  }

  function normalizeFiveElements(source = {}) {
    const ratio = source.ratio || source;
    return {
      wood: Math.round(Number(ratio.wood || 0)),
      fire: Math.round(Number(ratio.fire || 0)),
      earth: Math.round(Number(ratio.earth || 0)),
      metal: Math.round(Number(ratio.metal || 0)),
      water: Math.round(Number(ratio.water || 0)),
    };
  }

  function getElementProfile(ratio) {
    const labels = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };
    const keys = ["wood", "fire", "earth", "metal", "water"];
    const sorted = keys.slice().sort((left, right) => Number(ratio[right] || 0) - Number(ratio[left] || 0));

    return {
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
      strongestLabel: labels[sorted[0]],
      weakestLabel: labels[sorted[sorted.length - 1]],
    };
  }

  function buildDefaultScores(ratio) {
    const values = Object.values(ratio).map(Number);
    const imbalance = Math.max(...values) - Math.min(...values);
    const career = clampScore(68 + Math.round((ratio.wood + ratio.fire) / 12));
    const money = clampScore(66 + Math.round((ratio.earth + ratio.metal) / 10));
    const love = clampScore(67 + Math.round((ratio.fire + ratio.water) / 16));
    const health = clampScore(88 - Math.round(imbalance / 2));
    const relationship = clampScore(66 + Math.round((ratio.wood + ratio.earth) / 14));

    return {
      money,
      career,
      health,
      love,
      relationship,
      total: Math.round((money + career + health + love + relationship) / 5),
    };
  }

  function getDefaultGoodActions(weakest) {
    const table = {
      wood: ["새로운 배움을 주 1회 이상 시작하기", "아침 계획을 글로 정리하기", "초록색 소품이나 산책으로 성장 리듬 만들기"],
      fire: ["햇빛을 받으며 몸을 깨우는 루틴 만들기", "표현해야 할 말은 차분히 전달하기", "작은 성취를 기록해 자신감 회복하기"],
      earth: ["식사와 수면 시간을 일정하게 고정하기", "큰 결정을 하기 전 체크리스트로 안정감 확보하기", "생활 공간의 중심을 정리하기"],
      metal: ["지출과 계약 조건을 숫자로 확인하기", "거절해야 할 일은 기준을 세워 분명히 말하기", "업무 도구와 문서를 정리해 판단력 높이기"],
      water: ["충분한 수면과 수분 섭취를 먼저 챙기기", "혼자 생각을 정리하는 시간을 확보하기", "감정이 올라올 때 바로 답하지 않고 시간을 두기"],
    };

    return table[weakest] || table.water;
  }

  function getDefaultAvoidActions(strongest) {
    const table = {
      wood: ["계획만 늘리고 마무리를 미루지 않기", "내 방식만 고집해 관계를 밀어붙이지 않기", "성급한 확장보다 완료 기준 먼저 정하기"],
      fire: ["감정이 올라온 즉시 결정하지 않기", "보여주기 위한 소비나 약속을 줄이기", "말의 속도가 빨라질수록 한 번 쉬어가기"],
      earth: ["안정만 붙잡다가 기회를 놓치지 않기", "걱정을 이유로 선택을 계속 미루지 않기", "몸이 무거울 때 생활 리듬을 방치하지 않기"],
      metal: ["판단이 날카로워질 때 표현을 부드럽게 조절하기", "이익만 보고 관계의 신뢰를 놓치지 않기", "완벽한 조건만 기다리다 실행을 늦추지 않기"],
      water: ["생각이 많아져 결정을 미루는 흐름을 줄이기", "불안해서 정보를 과하게 모으지 않기", "감정을 숨기기만 하지 말고 필요한 말은 정리해 전달하기"],
    };

    return table[strongest] || table.water;
  }

  function buildDefaultSummary(profile, year, yearPillar) {
    return limitText(
      [
        `사주 구조를 보면 ${profile.strongestLabel} 기운이 비교적 강하고 ${profile.weakestLabel} 기운을 생활 속에서 보완하는 흐름이 필요합니다.`,
        `올해는 ${year}년 ${yearPillar} 세운을 기준으로 속도보다 기준을 세우는 선택이 유리합니다.`,
        "일과 돈은 확장보다 역할, 지출, 반복 가능한 성과를 정리할수록 안정됩니다.",
        "관계와 건강은 감정의 속도를 낮추고 생활 리듬을 일정하게 가져갈 때 흐름이 부드러워지며, 무리한 비교보다 꾸준한 조정이 중요합니다.",
      ].join(" "),
      400,
    );
  }

  function buildTodayInsight(profile, birthData, saju) {
    const seed = createPersonalSeed(birthData, saju);
    const messages = [
      "속도를 조금 줄이면 방향이 또렷해집니다.",
      `${profile.weakestLabel} 기운을 채우면 균형이 잡힙니다.`,
      "오늘은 확장보다 정리가 더 유리합니다.",
      `${profile.strongestLabel} 기운을 부드럽게 쓰는 날입니다.`,
      `${profile.weakestLabel} 기운을 보완할수록 흐름이 열립니다.`,
      "말보다 리듬을 맞출 때 운이 편안합니다.",
    ];

    return fitInsight(messages[seed % messages.length]);
  }

  function fitInsight(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length >= 20 && clean.length <= 35) return clean;
    if (clean.length > 35) return `${clean.slice(0, 34).trim()}.`;
    return `오늘은 ${clean}`;
  }

  function getDefaultLucky(weakest, birthData, saju) {
    const element = getElementKey(saju.yongSin) || weakest || "water";
    const seed = createPersonalSeed(birthData, saju);
    const table = {
      wood: {
        colors: ["딥 그린", "청록", "올리브 그린", "에메랄드"],
        directions: ["동쪽", "동남쪽"],
        numbers: [3, 4, 8],
      },
      fire: {
        colors: ["와인 레드", "코랄 오렌지", "로즈 핑크", "버건디"],
        directions: ["남쪽", "남동쪽"],
        numbers: [2, 7, 9],
      },
      earth: {
        colors: ["샌드 골드", "웜 베이지", "브라운", "머스터드"],
        directions: ["중앙", "남서쪽"],
        numbers: [5, 6, 10],
      },
      metal: {
        colors: ["샴페인 실버", "아이보리 화이트", "플래티넘", "소프트 골드"],
        directions: ["서쪽", "북서쪽"],
        numbers: [4, 7, 9],
      },
      water: {
        colors: ["딥 블루", "네이비", "블랙", "아쿠아 블루"],
        directions: ["북쪽", "북동쪽"],
        numbers: [1, 6, 8],
      },
    };
    const meta = table[element] || table.water;

    return {
      color: meta.colors[seed % meta.colors.length],
      number: String(meta.numbers[Math.floor(seed / 3) % meta.numbers.length]),
      direction: meta.directions[Math.floor(seed / 7) % meta.directions.length],
    };
  }

  function getElementKey(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("wood") || text.includes("목")) return "wood";
    if (text.includes("fire") || text.includes("화")) return "fire";
    if (text.includes("earth") || text.includes("토")) return "earth";
    if (text.includes("metal") || text.includes("금")) return "metal";
    if (text.includes("water") || text.includes("수")) return "water";
    return "";
  }

  function createPersonalSeed(birthData, saju) {
    const source = [
      birthData.birthDate,
      birthData.hourUnknown ? "UNKNOWN" : birthData.birthTime,
      birthData.gender,
      birthData.calendarType,
      saju.dayPillar,
      saju.yongSin,
      saju.heeSin,
    ].join("|");
    let hash = 0;

    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) % 1000003;
    }

    return Math.abs(hash);
  }

  function limitText(text, limit) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!limit || clean.length <= limit) return clean;
    return `${clean.slice(0, limit - 1).trim()}…`;
  }

  function clampScore(value) {
    return Math.round(window.SajuUtils.clamp(value, 0, 100));
  }

  window.GeminiService = {
    askQuestion,
    requestFortune,
  };
})();
