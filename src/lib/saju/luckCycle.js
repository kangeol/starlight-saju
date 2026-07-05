/**
 * 대운, 세운, 12운성, 12신살의 기본 구조를 계산합니다.
 * 실제 절기까지 반영한 시작 나이는 상용 만세력 테이블로 보강할 수 있게 분리했습니다.
 */
(function () {
  const TWELVE_STAGES = [
    "장생",
    "목욕",
    "관대",
    "건록",
    "제왕",
    "쇠",
    "병",
    "사",
    "묘",
    "절",
    "태",
    "양",
  ];

  const TWELVE_SINSAL = [
    "겁살",
    "재살",
    "천살",
    "지살",
    "연살",
    "월살",
    "망신살",
    "장성살",
    "반안살",
    "역마살",
    "육해살",
    "화개살",
  ];

  function isForwardLuck(gender, yearStem) {
    const stemMeta = window.SajuGanji.getStemMeta(yearStem);
    const isYangYear = stemMeta ? stemMeta.yinYang === "yang" : true;
    return (gender === "male" && isYangYear) || (gender === "female" && !isYangYear);
  }

  function calculateTwelveStages(dayStem, pillars) {
    const dayStemIndex = window.SajuGanji.STEMS.indexOf(dayStem);

    return pillars.map((pillar) => {
      const branchIndex = window.SajuGanji.BRANCHES.indexOf(pillar.branch);
      const stageIndex = window.SajuUtils.mod(branchIndex - dayStemIndex, 12);
      return {
        pillar: pillar.text,
        stage: branchIndex >= 0 ? TWELVE_STAGES[stageIndex] : "미상",
      };
    });
  }

  function calculateTwelveSinsal(yearBranch, pillars) {
    const yearBranchIndex = window.SajuGanji.BRANCHES.indexOf(yearBranch);

    return pillars.map((pillar) => {
      const branchIndex = window.SajuGanji.BRANCHES.indexOf(pillar.branch);
      const sinsalIndex = window.SajuUtils.mod(branchIndex - yearBranchIndex, 12);
      return {
        pillar: pillar.text,
        sinsal: branchIndex >= 0 ? TWELVE_SINSAL[sinsalIndex] : "미상",
      };
    });
  }

  function calculateLuckCycle(input, yearPillar, monthPillar) {
    const birth = window.SajuUtils.parseDate(input.birthDate);
    const forward = isForwardLuck(input.gender, yearPillar.stem);
    const monthIndex = monthPillar.index || 0;
    const startAge = estimateStartAge(birth);
    const cycles = [];

    for (let index = 0; index < 8; index += 1) {
      const pillarIndex = window.SajuUtils.mod(
        monthIndex + (forward ? index + 1 : -(index + 1)),
        60,
      );
      const pillar = window.SajuGanji.getPillarByIndex(pillarIndex);

      cycles.push({
        ageStart: startAge + index * 10,
        ageEnd: startAge + index * 10 + 9,
        pillar: pillar.text,
        direction: forward ? "순행" : "역행",
      });
    }

    return cycles;
  }

  function calculateYearFortune(year) {
    const targetYear = year || new Date().getFullYear();
    const pillar = window.SajuGanji.getPillarByIndex(targetYear - 4);

    return {
      year: targetYear,
      pillar: pillar.text,
      stem: pillar.stem,
      branch: pillar.branch,
    };
  }

  function estimateStartAge(birth) {
    if (!birth) return 7;
    const seed = (birth.month * 2 + birth.day) % 8;
    return Math.max(3, seed + 3);
  }

  window.SajuLuckCycle = {
    calculateLuckCycle,
    calculateTwelveSinsal,
    calculateTwelveStages,
    calculateYearFortune,
  };
})();
