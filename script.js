const API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";

const form = document.querySelector("#search-form");
const input = document.querySelector("#word-input");
const statusEl = document.querySelector("#status");
const errorEl = document.querySelector("#error");
const resultEl = document.querySelector("#result");
const wordEl = document.querySelector("#result-word");
const phoneticEl = document.querySelector("#result-phonetic");
const meaningsEl = document.querySelector("#meanings");
const sourceEl = document.querySelector("#source");
const audioBtn = document.querySelector("#audio-btn");
const saveBtn = document.querySelector("#save-btn");
const savedList = document.querySelector("#saved-list");
const savedEmpty = document.querySelector("#saved-empty");
const themeToggle = document.querySelector("#theme-toggle");

const state = {
  current: null,
  saved: loadStorage("wordly-saved", []),
  audio: null
};

function loadStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function createEl(tag, text = "", className = "") {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

async function fetchWord(word) {
  let response;
  try {
    response = await fetch(API_URL + encodeURIComponent(word));
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  if (response.status === 404) {
    throw new Error(`No definitions found for "${word}".`);
  }
  if (!response.ok) {
    throw new Error("The dictionary service is unavailable. Please try again later.");
  }
  return response.json();
}

function parseEntry(data) {
  const entry = data[0];
  const phonetics = entry.phonetics || [];

  return {
    word: entry.word,
    phonetic: entry.phonetic || phonetics.find((p) => p.text)?.text || "",
    audio: phonetics.find((p) => p.audio)?.audio || "",
    source: entry.sourceUrls?.[0] || "",
    meanings: entry.meanings.map((meaning) => ({
      partOfSpeech: meaning.partOfSpeech,
      definitions: meaning.definitions.slice(0, 3).map((d) => ({
        definition: d.definition,
        example: d.example || ""
      })),
      synonyms: [
        ...new Set([
          ...(meaning.synonyms || []),
          ...meaning.definitions.flatMap((d) => d.synonyms || [])
        ])
      ].slice(0, 8)
    }))
  };
}

function renderMeaning(meaning) {
  const section = createEl("section", "", "meaning");
  section.append(createEl("h3", meaning.partOfSpeech));

  const list = document.createElement("ol");
  meaning.definitions.forEach(({ definition, example }) => {
    const item = createEl("li", definition);
    if (example) item.append(createEl("p", `"${example}"`, "example"));
    list.append(item);
  });
  section.append(list);

  if (meaning.synonyms.length) {
    const chips = createEl("ul", "", "chips");
    chips.setAttribute("aria-label", `Synonyms for ${meaning.partOfSpeech}`);
    meaning.synonyms.forEach((synonym) => {
      const li = document.createElement("li");
      const btn = createEl("button", synonym);
      btn.type = "button";
      btn.addEventListener("click", () => search(synonym));
      li.append(btn);
      chips.append(li);
    });
    section.append(createEl("p", "Synonyms", "example"), chips);
  }

  return section;
}

function renderResult(entry) {
  state.current = entry;
  wordEl.textContent = entry.word;
  phoneticEl.textContent = entry.phonetic;

  meaningsEl.replaceChildren(...entry.meanings.map(renderMeaning));

  audioBtn.hidden = !entry.audio;
  state.audio = entry.audio ? new Audio(entry.audio) : null;

  sourceEl.replaceChildren();
  if (entry.source) {
    const link = createEl("a", entry.source);
    link.href = entry.source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    sourceEl.append("Source: ", link);
  }

  updateSaveState();
  resultEl.hidden = false;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  resultEl.hidden = true;
}

function clearError() {
  errorEl.textContent = "";
  errorEl.hidden = true;
}

async function search(word) {
  const term = word.trim().toLowerCase();
  if (!term) return;

  input.value = term;
  clearError();
  statusEl.textContent = "Searching...";

  try {
    const data = await fetchWord(term);
    renderResult(parseEntry(data));
  } catch (error) {
    showError(error.message);
  } finally {
    statusEl.textContent = "";
  }
}

function isSaved(word) {
  return state.saved.includes(word);
}

function updateSaveState() {
  const saved = state.current && isSaved(state.current.word);
  resultEl.classList.toggle("saved", Boolean(saved));
  saveBtn.textContent = saved ? "Remove from saved" : "Save word";
  saveBtn.setAttribute("aria-pressed", String(Boolean(saved)));
}

function renderSaved() {
  savedEmpty.hidden = state.saved.length > 0;
  savedList.replaceChildren(
    ...state.saved.map((word) => {
      const li = document.createElement("li");
      const btn = createEl("button", word);
      btn.type = "button";
      btn.addEventListener("click", () => search(word));
      li.append(btn);
      return li;
    })
  );
}

function toggleSave() {
  if (!state.current) return;
  const word = state.current.word;
  state.saved = isSaved(word)
    ? state.saved.filter((w) => w !== word)
    : [...state.saved, word];
  saveStorage("wordly-saved", state.saved);
  updateSaveState();
  renderSaved();
}

function playAudio() {
  if (!state.audio) return;
  state.audio.currentTime = 0;
  state.audio.play().catch(() => {
    showError("Audio could not be played.");
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  saveStorage("wordly-theme", theme);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  search(input.value);
});

saveBtn.addEventListener("click", toggleSave);
audioBtn.addEventListener("click", playAudio);

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

applyTheme(loadStorage("wordly-theme", "light"));
renderSaved();