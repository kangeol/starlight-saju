/**
 * 천간/지지와 사주 네 기둥 계산에 필요한 기본 데이터입니다.
 * 절기 보정은 입춘 기준의 간단 보정만 적용했으며, 상용 서비스에서는 절기 테이블을 추가하면 됩니다.
 */
(function () {
  const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
  const BRANCHES = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];

  const STEM_META = {
    갑: { element: "wood", yinYang: "yang" },
    을: { element: "wood", yinYang: "yin" },
    병: { element: "fire", yinYang: "yang" },
    정: { element: "fire", yinYang: "yin" },
    무: { element: "earth", yinYang: "yang" },
    기: { element: "earth", yinYang: "yin" },
    경: { element: "metal", yinYang: "yang" },
    신: { element: "metal", yinYang: "yin" },
    임: { element: "water", yinYang: "yang" },
    계: { element: "water", yinYang: "yin" },
  };

  const BRANCH_META = {
    자: { element: "water", yinYang: "yang", hiddenStems: ["계"] },
    축: { element: "earth", yinYang: "yin", hiddenStems: ["기", "계", "신"] },
    인: { element: "wood", yinYang: "yang", hiddenStems: ["갑", "병", "무"] },
    묘: { element: "wood", yinYang: "yin", hiddenStems: ["을"] },
    진: { element: "earth", yinYang: "yang", hiddenStems: ["무", "을", "계"] },
    사: { element: "fire", yinYang: "yin", hiddenStems: ["병", "무", "경"] },
    오: { element: "fire", yinYang: "yang", hiddenStems: ["정", "기"] },
    미: { element: "earth", yinYang: "yin", hiddenStems: ["기", "정", "을"] },
    신: { element: "metal", yinYang: "yang", hiddenStems: ["경", "임", "무"] },
    유: { element: "metal", yinYang: "yin", hiddenStems: ["신"] },
    술: { element: "earth", yinYang: "yang", hiddenStems: ["무", "신", "정"] },
    해: { element: "water", yinYang: "yin", hiddenStems: ["임", "갑"] },
  };

  const MONTH_BRANCH_BY_SOLAR_MONTH = [
    "축",
    "인",
    "묘",
    "진",
    "사",
    "오",
    "미",
    "신",
    "유",
    "술",
    "해",
    "자",
  ];

  const HOUR_BRANCHES = [
    { branch: "자", start: 23.5, end: 1.5 },
    { branch: "축", start: 1.5, end: 3.5 },
    { branch: "인", start: 3.5, end: 5.5 },
    { branch: "묘", start: 5.5, end: 7.5 },
    { branch: "진", start: 7.5, end: 9.5 },
    { branch: "사", start: 9.5, end: 11.5 },
    { branch: "오", start: 11.5, end: 13.5 },
    { branch: "미", start: 13.5, end: 15.5 },
    { branch: "신", start: 15.5, end: 17.5 },
    { branch: "유", start: 17.5, end: 19.5 },
    { branch: "술", start: 19.5, end: 21.5 },
    { branch: "해", start: 21.5, end: 23.5 },
  ];

  function getPillarByIndex(index) {
    const safeIndex = window.SajuUtils.mod(index, 60);
    return {
      stem: STEMS[safeIndex % 10],
      branch: BRANCHES[safeIndex % 12],
      text: `${STEMS[safeIndex % 10]}${BRANCHES[safeIndex % 12]}`,
      index: safeIndex,
    };
  }

  function getYearPillar(dateParts) {
    const beforeIpchun = dateParts.month === 1 || (dateParts.month === 2 && dateParts.day < 4);
    const sajuYear = beforeIpchun ? dateParts.year - 1 : dateParts.year;
    return getPillarByIndex(sajuYear - 4);
  }

  function getMonthPillar(dateParts, yearPillar) {
    const branch = MONTH_BRANCH_BY_SOLAR_MONTH[dateParts.month - 1];
    const branchIndex = BRANCHES.indexOf(branch);
    const yearStemIndex = STEMS.indexOf(yearPillar.stem);
    const startStemIndexByYearStem = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0];
    const inMonthOffset = window.SajuUtils.mod(branchIndex - 2, 12);
    const stem = STEMS[(startStemIndexByYearStem[yearStemIndex] + inMonthOffset) % 10];

    return {
      stem,
      branch,
      text: `${stem}${branch}`,
      index: branchIndex,
    };
  }

  function getJulianDay(year, month, day) {
    let adjustedYear = year;
    let adjustedMonth = month;

    if (adjustedMonth <= 2) {
      adjustedYear -= 1;
      adjustedMonth += 12;
    }

    const a = Math.floor(adjustedYear / 100);
    const b = 2 - a + Math.floor(a / 4);

    return (
      Math.floor(365.25 * (adjustedYear + 4716)) +
      Math.floor(30.6001 * (adjustedMonth + 1)) +
      day +
      b -
      1524
    );
  }

  function getDayPillar(dateParts) {
    const julianDay = getJulianDay(dateParts.year, dateParts.month, dateParts.day);
    return getPillarByIndex(julianDay + 49);
  }

  function getHourBranchFromInput(birthTime) {
    if (!birthTime || birthTime === "unknown") {
      return { branch: "미상", timeLabel: "모름" };
    }

    const [startTime] = birthTime.split("-");
    const [hour, minute] = startTime.split(":").map(Number);
    const decimalHour = hour + minute / 60;

    const match = HOUR_BRANCHES.find((item) => {
      if (item.start > item.end) {
        return decimalHour >= item.start || decimalHour < item.end;
      }

      return decimalHour >= item.start && decimalHour < item.end;
    });

    return {
      branch: match ? match.branch : "미상",
      timeLabel: birthTime,
    };
  }

  function getHourPillar(birthTime, dayPillar) {
    const hourBranch = getHourBranchFromInput(birthTime);

    if (hourBranch.branch === "미상") {
      return {
        stem: "미상",
        branch: "미상",
        text: "시간 미상",
        timeLabel: hourBranch.timeLabel,
      };
    }

    const dayStemIndex = STEMS.indexOf(dayPillar.stem);
    const hourBranchIndex = BRANCHES.indexOf(hourBranch.branch);
    const startStemByDayStem = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];
    const stem = STEMS[(startStemByDayStem[dayStemIndex] + hourBranchIndex) % 10];

    return {
      stem,
      branch: hourBranch.branch,
      text: `${stem}${hourBranch.branch}`,
      timeLabel: hourBranch.timeLabel,
    };
  }

  function getStemMeta(stem) {
    return STEM_META[stem] || null;
  }

  function getBranchMeta(branch) {
    return BRANCH_META[branch] || null;
  }

  window.SajuGanji = {
    BRANCHES,
    BRANCH_META,
    STEMS,
    STEM_META,
    getBranchMeta,
    getDayPillar,
    getHourPillar,
    getMonthPillar,
    getPillarByIndex,
    getStemMeta,
    getYearPillar,
  };
})();
