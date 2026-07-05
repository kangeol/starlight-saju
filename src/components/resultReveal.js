/**
 * 결과 화면이 책이 열리듯 차분하게 펼쳐지는 V4 등장 연출입니다.
 */
(function () {
  const fortuneLabels = {
    money: "재물운",
    career: "직장운",
    health: "건강운",
    love: "애정운",
    relationship: "대인운",
  };

  function reveal(session) {
    const result = document.querySelector("#result");
    const intro = document.querySelector("#resultRevealMessage");
    if (!result) return;

    const dominantFortune = getDominantFortune(session.analysis.scores);
    result.classList.remove("result-gate-opening", "result-gate-opened");

    // Force the opening animation to restart when the same result is rendered again.
    void result.offsetWidth;
    result.classList.add("result-gate-opening");
    window.setTimeout(() => result.classList.add("result-gate-opened"), 1540);

    if (intro) {
      intro.innerHTML = `
        <strong>당신의 운명을 읽었습니다.</strong>
        <span>올해 가장 강하게 빛나는 기운은 ${dominantFortune}입니다.</span>
      `;
      intro.classList.remove("hidden");
      window.setTimeout(() => intro.classList.add("hidden"), 1100);
    }

    const items = result.querySelectorAll("[data-reveal]");
    items.forEach((item, index) => {
      item.classList.remove("reveal-visible");
      item.style.setProperty("--reveal-delay", `${980 + index * 120}ms`);
      window.setTimeout(() => item.classList.add("reveal-visible"), 30);
    });
  }

  function getDominantFortune(scores) {
    const entries = Object.entries(scores || {});
    if (!entries.length) return "직장운";

    const [key] = entries.reduce((best, current) => {
      return Number(current[1]) > Number(best[1]) ? current : best;
    });

    return fortuneLabels[key] || "직장운";
  }

  window.ResultReveal = {
    getDominantFortune,
    reveal,
  };
})();
