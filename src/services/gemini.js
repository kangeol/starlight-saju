/**
 * Gemini 직접 호출 파일이 아닙니다.
 * 프론트엔드는 Google Apps Script URL로만 요청하고, Apps Script가 Gemini API를 호출합니다.
 */
(function () {
  function getConfig() {
    return window.AppConfig.getRuntimeConfig();
  }

  async function requestFortune({ birthData, saju }) {
    const config = getConfig();

    if (!config.APPS_SCRIPT_URL && config.USE_MOCK_WHEN_API_EMPTY) {
      await wait(900);
      return createMockAnalysis(birthData, saju);
    }

    const response = await postToProxy({
      type: "fortune",
      payload: {
        birthData,
        saju,
      },
      settings: {
        model: config.DEFAULT_MODEL,
        promptMemo: config.promptMemo,
      },
    });

    return normalizeAnalysis(response, birthData, saju);
  }

  async function askQuestion({ session, question }) {
    const config = getConfig();

    if (!config.APPS_SCRIPT_URL && config.USE_MOCK_WHEN_API_EMPTY) {
      await wait(500);
      return {
        answer: createMockQuestionAnswer(session, question),
      };
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
        "별빛 연결이 잠시 불안정합니다. 잠시 후 다시 시도해주세요.",
    };
  }

  async function postToProxy(body) {
    const config = getConfig();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), config.API_TIMEOUT_MS);

    try {
      const response = await fetch(config.APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`별빛 연결이 잠시 불안정합니다. 서버 응답: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(
          data.message ||
            "별빛 연결이 잠시 불안정합니다. 잠시 후 다시 시도해주세요.",
        );
      }

      return data;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function normalizeAnalysis(data, birthData, saju) {
    const mock = createMockAnalysis(birthData, saju);
    const scores = data.scores || {};

    return {
      sessionId: data.sessionId || window.SajuUtils.createId("session"),
      totalScore: clampScore(data.totalScore ?? mock.totalScore),
      scores: {
        money: clampScore(scores.money ?? mock.scores.money),
        career: clampScore(scores.career ?? mock.scores.career),
        health: clampScore(scores.health ?? mock.scores.health),
        love: clampScore(scores.love ?? mock.scores.love),
        relationship: clampScore(scores.relationship ?? mock.scores.relationship),
      },
      summary: data.summary || mock.summary,
      sections: {
        ...mock.sections,
        ...(data.sections || {}),
      },
      luckyItems: Array.isArray(data.luckyItems) ? data.luckyItems : mock.luckyItems,
      meta: {
        ...(data.meta || {}),
        mode: data.meta?.mode || "api",
      },
    };
  }

  function createMockAnalysis(birthData, saju) {
    const name = birthData.name || "당신";
    const dominant = saju.fiveElements.labels[saju.fiveElements.dominant];
    const weakest = saju.fiveElements.labels[saju.fiveElements.weakest];
    const yearPillar = saju.yearPillar;
    const dayPillar = saju.dayPillar;

    return {
      sessionId: window.SajuUtils.createId("mock"),
      totalScore: 91,
      scores: {
        money: 86,
        career: 92,
        health: 78,
        love: 82,
        relationship: 88,
      },
      summary: `${name}님의 올해는 ${dominant} 기운의 추진력과 ${weakest} 기운을 보완하려는 별빛의 흐름이 함께 작동하는 시기입니다.`,
      sections: {
        personality: `${name}님의 일주는 ${dayPillar}로 계산됩니다. 겉으로 드러나는 태도보다 안쪽의 기준이 분명하고, 한 번 마음을 정하면 꾸준히 밀고 가는 힘이 있습니다. 다만 현재 오행 분포에서 ${dominant} 기운이 강하고 ${weakest} 기운이 약하게 잡히므로, 강점이 과해질 때는 고집이나 조급함으로 보일 수 있습니다. 올해는 속도를 높이는 것보다 균형을 맞추는 선택이 운의 질을 높입니다.`,
        earlyLife: `초년운은 년주 ${yearPillar}의 영향을 받아 주변 환경과 가족 분위기의 영향을 섬세하게 받는 흐름입니다. 일찍부터 책임감을 배웠거나, 스스로 눈치를 보며 상황을 정리하는 습관이 생겼을 수 있습니다. 이 경험은 지금의 관찰력과 판단력으로 이어집니다.`,
        middleLife: "중년운은 전문성, 신뢰, 반복 경험이 성과로 바뀌는 구간입니다. 갑작스러운 반전보다 꾸준히 쌓은 실력이 사람들에게 인정받는 흐름입니다. 일의 범위가 넓어질수록 기준을 문서화하고 루틴을 만드는 것이 좋습니다.",
        lateLife: "말년운은 무리한 확장보다 안정과 정리가 중요한 흐름입니다. 오래 유지할 수 있는 관계와 생활 방식을 만들수록 기운이 편안해집니다. 취향, 공부, 작은 사업처럼 자신만의 리듬을 살리는 활동이 잘 맞습니다.",
        yearFortune: `올해 세운은 ${saju.yearFortune.pillar}입니다. 외부 기회는 들어오지만 모든 제안을 바로 받아들이기보다 내 기준과 장기 방향에 맞는지 점검해야 합니다. 새로운 역할, 계약, 협업은 준비된 사람에게 좋은 결과를 줄 가능성이 큽니다.`,
        money: "재물운은 한 번의 큰 수익보다 관리와 반복 수익에 강점이 있습니다. 지출을 기록하고, 고정비를 낮추고, 작은 수익원을 꾸준히 키우는 방식이 좋습니다. 주변 권유만으로 움직이는 투자는 피하는 편이 안전합니다.",
        career: "직업운은 강하게 살아나는 편입니다. 맡은 일을 구조화하고 결과를 숫자나 포트폴리오로 남기면 평가가 좋아집니다. 특히 기획, 관리, 상담, 콘텐츠, 데이터 정리처럼 판단력과 섬세함이 함께 필요한 일에 힘이 실립니다.",
        business: "사업운은 작게 검증하고 넓히는 방식에 적합합니다. 처음부터 큰 비용을 쓰기보다 반응을 확인하고, 고객의 문제를 구체적으로 해결하는 상품을 만드는 것이 유리합니다.",
        jobChange: "이직운은 준비된 이동에는 긍정적입니다. 감정적으로 떠나는 선택보다 역할, 연봉, 성장 가능성, 생활 리듬을 함께 비교해야 합니다. 최소 두 개 이상의 선택지를 확보한 뒤 움직이면 후회가 줄어듭니다.",
        love: "애정운은 빠르게 타오르는 인연보다 대화가 편하고 생활 리듬이 맞는 관계에 유리합니다. 기존 관계에서는 서운함을 쌓아두지 말고 작게라도 자주 표현하는 것이 좋습니다.",
        marriage: "결혼운은 현실적인 대화가 깊어질 때 좋아집니다. 감정보다 돈 관리, 가족과의 거리, 생활 습관 같은 구체적인 기준을 맞추는 과정이 중요합니다.",
        health: "건강운은 과로와 수면 부족 관리가 핵심입니다. 진단처럼 단정할 수는 없지만, 목과 어깨 긴장, 위장 부담, 순환 저하가 느껴질 때는 미루지 말고 생활 리듬을 조정하는 것이 좋습니다.",
        relationship: "대인관계는 넓히는 것보다 정리하고 깊게 만드는 쪽이 유리합니다. 모든 사람에게 좋은 사람이 되려는 태도는 에너지를 소모시킬 수 있습니다. 믿을 만한 사람과 꾸준히 연결되는 관계가 운을 안정시킵니다.",
        goodActions: "아침 루틴 만들기, 지출 기록하기, 책상과 지갑 정리하기, 오래 미룬 연락 정리하기, 20분 산책이 좋습니다. 작은 행동을 반복하는 것이 올해의 운을 실제 성과로 바꿉니다.",
        cautions: "충동적인 계약, 감정적 소비, 피곤한 상태에서의 중요한 결정은 피하세요. 특히 남의 속도에 맞추느라 자신의 기준을 잃는 것이 올해 가장 주의할 부분입니다.",
        luckyColor: `행운의 색은 ${dominant} 기운을 차분히 쓰는 네이비와 ${weakest} 기운을 보완하는 골드 계열입니다.`,
        luckyNumber: "행운의 숫자는 3, 8, 12입니다.",
        luckyDirection: "행운의 방향은 동쪽과 남동쪽입니다. 중요한 약속이나 산책 코스에 가볍게 활용해 보세요.",
      },
      luckyItems: [
        {
          title: "균형을 잡아주는 네이비 다이어리",
          description:
            "부족한 기운을 보완하는 상징 아이템입니다. 계획과 실행의 분위기를 정돈하는 데 어울립니다.",
          url: getConfig().recommendationBaseUrl,
        },
        {
          title: "금 기운을 보완하는 슬림 지갑",
          description:
            "실제 효능을 보장하는 것이 아니라 재물 흐름을 차분히 관리한다는 상징을 담은 추천입니다.",
          url: getConfig().recommendationBaseUrl,
        },
      ],
      meta: {
        mode: "mock",
        note: "Apps Script URL이 비어 있어 mock 분석을 표시했습니다.",
      },
    };
  }

  function createMockQuestionAnswer(session, question) {
    const saju = session.saju;
    const dominant = saju.fiveElements.labels[saju.fiveElements.dominant];
    const weakest = saju.fiveElements.labels[saju.fiveElements.weakest];

    if (question.includes("이직")) {
      return `이직은 가능성이 있습니다. 다만 ${dominant} 기운이 강하게 움직일 때는 결정이 빨라질 수 있으니, 조건표를 만들어 비교한 뒤 움직이는 편이 좋습니다. 특히 역할, 연봉, 성장 가능성, 생활 리듬을 함께 보세요. ${weakest} 기운을 보완하려면 급하게 답을 내기보다 2주 정도 검토 기간을 두는 것이 좋습니다.`;
    }

    if (question.includes("창업") || question.includes("사업")) {
      return `창업은 작게 검증하는 방식이 어울립니다. 처음부터 크게 벌리기보다 고객 반응을 확인하고, 반복 구매가 가능한 구조를 만드는 것이 중요합니다. 올해는 실행운이 있지만 무리한 고정비는 부담이 될 수 있습니다.`;
    }

    if (question.includes("결혼") || question.includes("연애")) {
      return `관계운은 현실적인 대화가 깊어질 때 좋아집니다. 감정의 크기만 보지 말고 생활 리듬, 돈 관리, 가족과의 거리처럼 오래 함께할 기준을 차분히 맞춰 보세요.`;
    }

    return `현재 사주 흐름을 기준으로 보면, 질문하신 일은 서두르기보다 기준을 세워 단계적으로 접근하는 편이 좋습니다. 강한 기운은 실행력으로 쓰고, 약한 기운은 기록과 상담, 충분한 휴식으로 보완하면 선택의 안정감이 커집니다.`;
  }

  function clampScore(value) {
    return Math.round(window.SajuUtils.clamp(value, 0, 100));
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  window.GeminiService = {
    askQuestion,
    createMockAnalysis,
    requestFortune,
  };
})();
