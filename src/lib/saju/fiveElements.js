/**
 * 오행, 십성, 지장간, 용신/희신 후보 계산 모듈입니다.
 * AI는 이 계산 결과를 받아 상담 문장만 작성합니다.
 */
(function () {
  const ELEMENT_LABELS = {
    wood: "목",
    fire: "화",
    earth: "토",
    metal: "금",
    water: "수",
  };

  const ELEMENT_ORDER = ["wood", "fire", "earth", "metal", "water"];
  const GENERATES = {
    wood: "fire",
    fire: "earth",
    earth: "metal",
    metal: "water",
    water: "wood",
  };
  const CONTROLS = {
    wood: "earth",
    earth: "water",
    water: "fire",
    fire: "metal",
    metal: "wood",
  };

  function emptyElements() {
    return {
      wood: 0,
      fire: 0,
      earth: 0,
      metal: 0,
      water: 0,
    };
  }

  function addElement(score, element, weight) {
    if (score[element] !== undefined) {
      score[element] += weight;
    }
  }

  function calculateFiveElements(pillars) {
    const score = emptyElements();

    pillars.forEach((pillar) => {
      const stemMeta = window.SajuGanji.getStemMeta(pillar.stem);
      const branchMeta = window.SajuGanji.getBranchMeta(pillar.branch);

      if (stemMeta) addElement(score, stemMeta.element, 2);
      if (branchMeta) addElement(score, branchMeta.element, 2);

      if (branchMeta) {
        branchMeta.hiddenStems.forEach((hiddenStem) => {
          const hiddenMeta = window.SajuGanji.getStemMeta(hiddenStem);
          if (hiddenMeta) addElement(score, hiddenMeta.element, 0.5);
        });
      }
    });

    const total = Object.values(score).reduce((sum, value) => sum + value, 0) || 1;
    const ratio = {};

    ELEMENT_ORDER.forEach((element) => {
      ratio[element] = Math.round((score[element] / total) * 100);
    });

    return {
      raw: score,
      ratio,
      labels: ELEMENT_LABELS,
      dominant: getExtremeElement(score, "max"),
      weakest: getExtremeElement(score, "min"),
    };
  }

  function getExtremeElement(score, mode) {
    return ELEMENT_ORDER.reduce((selected, element) => {
      if (!selected) return element;
      return mode === "max"
        ? score[element] > score[selected]
          ? element
          : selected
        : score[element] < score[selected]
          ? element
          : selected;
    }, "");
  }

  function getTenGod(dayStem, targetStem) {
    const day = window.SajuGanji.getStemMeta(dayStem);
    const target = window.SajuGanji.getStemMeta(targetStem);

    if (!day || !target) return "미상";

    const samePolarity = day.yinYang === target.yinYang;

    if (day.element === target.element) return samePolarity ? "비견" : "겁재";
    if (GENERATES[day.element] === target.element) return samePolarity ? "식신" : "상관";
    if (CONTROLS[day.element] === target.element) return samePolarity ? "편재" : "정재";
    if (CONTROLS[target.element] === day.element) return samePolarity ? "편관" : "정관";
    if (GENERATES[target.element] === day.element) return samePolarity ? "편인" : "정인";

    return "미상";
  }

  function calculateTenGods(dayPillar, pillars) {
    const result = {};

    pillars.forEach((pillar, index) => {
      const key = ["year", "month", "day", "hour"][index];
      result[key] = {
        stem: getTenGod(dayPillar.stem, pillar.stem),
        branchMain: getTenGod(dayPillar.stem, getMainHiddenStem(pillar.branch)),
      };
    });

    return result;
  }

  function getMainHiddenStem(branch) {
    const meta = window.SajuGanji.getBranchMeta(branch);
    return meta ? meta.hiddenStems[0] : "";
  }

  function calculateHiddenStems(pillars) {
    const result = {};

    pillars.forEach((pillar, index) => {
      const key = ["year", "month", "day", "hour"][index];
      const meta = window.SajuGanji.getBranchMeta(pillar.branch);
      result[key] = meta ? meta.hiddenStems : [];
    });

    return result;
  }

  function calculateYongHee(fiveElements) {
    const weakest = fiveElements.weakest;
    const dominant = fiveElements.dominant;
    const heeSin = GENERATES[weakest] || weakest;

    return {
      yongSin: ELEMENT_LABELS[weakest],
      heeSin: ELEMENT_LABELS[heeSin],
      explanation: `현재 오행 분포에서는 ${ELEMENT_LABELS[dominant]} 기운이 두드러지고 ${ELEMENT_LABELS[weakest]} 기운이 상대적으로 약합니다.`,
    };
  }

  window.SajuFiveElements = {
    ELEMENT_LABELS,
    ELEMENT_ORDER,
    calculateFiveElements,
    calculateHiddenStems,
    calculateTenGods,
    calculateYongHee,
    getTenGod,
  };
})();
