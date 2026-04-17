(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const els = {
    card: $(".card"),
    questionRow: $(".questionRow"),
    genderBtns: document.querySelectorAll(".gbtn"),
    correctStat: $("#correctStat"),
    wrongStat: $("#wrongStat"),
    progressStat: $("#progressStat"),
    questionText: $("#questionText"),
    sentencePanels: $("#sentencePanels"),
    feedback: $("#feedback"),
    resultBox: $("#resultBox"),
    resultSubj: $("#resultSubj"),
    resultAkk: $("#resultAkk"),
    startBtn: $("#startBtn"),
    nextBtn: $("#nextBtn"),
    repeatBtn: $("#repeatBtn"),
  };

  const DATA_FILES = {
    m: "questions_m.json",
    f: "questions_f.json",
    n: "questions_n.json",
  };

  const SET_SIZE = 20;
  const KIDS_APP_PROGRESS_KEY = "kids-app-study-progress-v1";
  const KIDS_APP_APP_ID = "kasus";

  const state = {
    gender: "m",
    banks: { m: null, f: null, n: null },
    currentItem: null,
    currentVariant: null,
    askType: null, // "SUBJ" | "AKK"
    firstAskType: null,
    locked: false,

    // set control
    setPos: -1,      // -1 before start, 0..19 during set
    correct: 0,      // questions answered correctly on the first try
    wrong: 0,        // questions that needed at least one retry
    practiceMode: false,
    missedCurrent: false,
  };

  function setFeedback(text, kind) {
    els.feedback.textContent = text || "";
    els.feedback.classList.remove("ok", "ng");
    if (kind) els.feedback.classList.add(kind);
  }

  function setHeaderStatus() {
    const q = (state.setPos >= 0) ? (state.setPos + 1) : 0;
    els.correctStat.textContent = `○ ${state.correct}`;
    els.wrongStat.textContent = `× ${state.wrong}`;
    els.progressStat.textContent = `${q} / ${SET_SIZE}`;
    reportKidsAppProgress(state.correct);
  }

  function getKidsAppTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function reportKidsAppProgress(correctCount) {
    try {
      const today = getKidsAppTodayKey();
      const raw = JSON.parse(localStorage.getItem(KIDS_APP_PROGRESS_KEY) || "{}");
      raw[today] ??= {};

      const prev = Number(raw[today][KIDS_APP_APP_ID]?.correct) || 0;
      raw[today][KIDS_APP_APP_ID] = {
        correct: Math.max(prev, Math.max(0, Math.floor(Number(correctCount) || 0))),
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(KIDS_APP_PROGRESS_KEY, JSON.stringify(raw));
    } catch {}
  }

  function resetUIForNewQuestion() {
    els.resultBox.hidden = true;
    els.nextBtn.disabled = true;
    els.repeatBtn.disabled = true;
    setFeedback("", null);
    els.sentencePanels.innerHTML = "";
    [...els.sentencePanels.querySelectorAll(".panel")].forEach(p => p.classList.remove("ok", "ng"));
  }

  function lockPanels(lock) {
    state.locked = lock;
    [...els.sentencePanels.querySelectorAll(".panel")].forEach(p => {
      p.classList.toggle("disabled", lock);
    });
  }

  function setPhaseStyle() {
    els.questionRow.classList.remove("phase-subj", "phase-akk");
    if (state.askType === "SUBJ") {
      els.questionRow.classList.add("phase-subj");
    } else if (state.askType === "AKK") {
      els.questionRow.classList.add("phase-akk");
    }
  }

  function getVerbFromVariant(v) {
    return v?.parts?.[1] || "…";
  }

  function pickAskType() {
    return Math.random() < 0.5 ? "SUBJ" : "AKK";
  }

  function setQuestionText() {
    const verb = getVerbFromVariant(state.currentVariant);

    if (state.askType === "SUBJ") {
      els.questionText.textContent = `Wer oder was ${verb}?  → Subjekt markieren`;
    } else {
      els.questionText.textContent = `Wen oder was ${verb}?  → Akkusativobjekt markieren`;
    }
  }

  function renderPanels() {
    const v = state.currentVariant;
    v.parts.forEach((txt, idx) => {
      const btn = document.createElement("button");
      btn.className = "panel";
      btn.type = "button";
      btn.textContent = txt;
      btn.dataset.idx = String(idx);
      btn.addEventListener("click", () => onPick(idx, btn));
      els.sentencePanels.appendChild(btn);
    });
  }

  function showResult() {
    const v = state.currentVariant;
    els.resultSubj.textContent = `${v.parts[v.subj]}  → Subjekt`;
    els.resultAkk.textContent = `${v.parts[v.akk]}  → Akkusativobjekt`;
    els.resultBox.hidden = false;
  }

  function markCorrectPanels() {
    const v = state.currentVariant;
    const panels = [...els.sentencePanels.querySelectorAll(".panel")];
    panels[v.subj]?.classList.add("ok");
    panels[v.akk]?.classList.add("ok");
  }

  function advancePrompt() {
    state.askType = (state.askType === "SUBJ") ? "AKK" : "SUBJ";
    setPhaseStyle();
    setQuestionText();
  }

  function onPick(idx, btnEl) {
    if (state.locked) return;

    const v = state.currentVariant;
    const expected = (state.askType === "SUBJ") ? v.subj : v.akk;

    [...els.sentencePanels.querySelectorAll(".panel")].forEach(p => p.classList.remove("ng"));

    if (idx === expected) {
      const isFirstStep = state.askType === state.firstAskType;
      btnEl.classList.add("ok");
      btnEl.classList.remove("ng");

      if (isFirstStep) {
        const nextLabel = (state.askType === "SUBJ")
          ? "Akkusativobjekt"
          : "Subjekt";
        setFeedback(`Richtig! Jetzt das ${nextLabel} markieren.`, "ok");
        advancePrompt();
        return;
      }

      if (!state.practiceMode && !state.missedCurrent) {
        state.correct += 1;
      }
      setHeaderStatus();

      lockPanels(true);
      setFeedback("Richtig!", "ok");

      showResult();
      markCorrectPanels();

      els.nextBtn.disabled = false;
      els.repeatBtn.disabled = false;
    } else {
      if (!state.practiceMode && !state.missedCurrent) {
        state.missedCurrent = true;
        state.wrong += 1;
        setHeaderStatus();
      }

      btnEl.classList.add("ng");
      setFeedback("Nicht ganz. Versuche es noch einmal.", "ng");
    }
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function isValidBank(bank) {
    if (!Array.isArray(bank)) return false;
    return bank.every(item =>
      item && typeof item.id === "string" &&
      Array.isArray(item.variants) && item.variants.length > 0 &&
      item.variants.every(v =>
        Array.isArray(v.parts) && v.parts.length === 5 &&
        Number.isInteger(v.subj) && Number.isInteger(v.akk)
      )
    );
  }

  async function ensureBankLoaded(g) {
    if (state.banks[g]) return;

    const file = DATA_FILES[g];
    setFeedback(`Lade Daten (${file})…`, null);

    try {
      const res = await fetch(file, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!isValidBank(json)) throw new Error("Ungültiges JSON-Format");

      state.banks[g] = json;
      setFeedback("", null);
    } catch (e) {
      state.banks[g] = [];
      els.questionText.textContent = "—";
      resetUIForNewQuestion();
      setFeedback(`Daten konnten nicht geladen werden: ${file}`, "ng");
    }
  }

  function endSet() {
    resetUIForNewQuestion();
    lockPanels(true);

    els.questionRow.classList.remove("phase-subj", "phase-akk");
    els.questionText.textContent = "Set beendet";
    setFeedback("Start drücken für ein neues Set (20 Fragen).", null);

    els.nextBtn.disabled = true;
    els.repeatBtn.disabled = true;
  }

  function loadQuestion() {
    resetUIForNewQuestion();

    const bank = state.banks[state.gender] || [];
    if (!bank.length) {
      setFeedback("Dieses Set ist noch nicht verfügbar.", "ng");
      els.questionText.textContent = "—";
      return;
    }

    state.currentItem = pickRandom(bank);
    state.currentVariant = pickRandom(state.currentItem.variants);
    state.firstAskType = pickAskType();
    state.askType = state.firstAskType;
    state.practiceMode = false;
    state.missedCurrent = false;

    setPhaseStyle();
    lockPanels(false);
    setQuestionText();
    renderPanels();
    setHeaderStatus();
  }

  function nextQuestion() {
    if (state.setPos < 0) return;

    if (state.setPos >= SET_SIZE - 1) {
      endSet();
      return;
    }

    state.setPos += 1;
    loadQuestion();
  }

  function repeatQuestion() {
    if (state.setPos < 0) return;
    if (!state.currentItem || !state.currentVariant) return;

    resetUIForNewQuestion();
    state.askType = state.firstAskType || "SUBJ";
    setPhaseStyle();
    state.practiceMode = true;
    state.missedCurrent = false;
    lockPanels(false);
    setQuestionText();
    renderPanels();
    setHeaderStatus();
  }

  async function setGender(g) {
    state.gender = g;
    els.genderBtns.forEach(b => b.classList.toggle("active", b.dataset.gender === g));

    await ensureBankLoaded(g);

    // if already in a set, reload current question with same position/rules
    if (state.setPos >= 0) loadQuestion();
    else {
      els.questionText.textContent = "Start drücken";
      setFeedback("", null);
    }
  }

  // events
  els.genderBtns.forEach(btn => {
    btn.addEventListener("click", () => setGender(btn.dataset.gender));
  });

  els.startBtn.addEventListener("click", async () => {
    state.correct = 0;
    state.wrong = 0;
    state.setPos = 0;
    state.practiceMode = false;
    state.missedCurrent = false;
    setHeaderStatus();

    await ensureBankLoaded(state.gender);
    loadQuestion();
  });

  els.nextBtn.addEventListener("click", nextQuestion);
  els.repeatBtn.addEventListener("click", repeatQuestion);

  // init
  setHeaderStatus();
  els.questionText.textContent = "Start drücken";
})();
