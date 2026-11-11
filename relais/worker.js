// Relais de l'app « Kalima Up » (darija) : traduction par Claude, écriture arabe pour la voix 🔊,
// synchronisation des mots, tri dans les dossiers, et onglet 🎓 Prof (discussion + leçons).
// À coller dans le Worker Cloudflare « kalima-relais » (Edit code → tout remplacer → Deploy).
// C'est un relais SÉPARÉ de celui de Word Up (carnet-deepl) : ne pas mélanger les deux.
//
// Variables (Settings → Variables and Secrets) :
//   ANTHROPIC_KEY   (Secret) ta clé API Claude (la même que pour Word Up)
//   APP_PASSWORD    (Secret) ton mot de passe pour Kalima Up, le même que dans l'app
//   ALLOWED_ORIGIN  (Text, facultatif) https://kurapika936.github.io
//   CLAUDE_MODEL    (Text, facultatif) par défaut claude-haiku-4-5-20251001
//   PROF_MODEL      (Text, facultatif) modèle de l'onglet Prof ; par défaut le même que CLAUDE_MODEL
// Liaison (Bindings) :
//   WORDS           (KV namespace) la base de Kalima Up (une base À ELLE, pas celle de Word Up)
//
// Dans les mots enregistrés, les champs « en » et « exEn » contiennent le DARIJA (noms gardés
// de Word Up pour que le code reste identique) ; « ar » et « exAr » sont l'écriture arabe
// du mot et de l'exemple, gardée en coulisse pour la voix (jamais affichée).

const MAX_CHARS = 1000;
const KEY = "carnet";
const FKEY = "dossiers";
const LKEY = "cours";
const MAX_ENTRIES = 20000;
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Écriture arabe : retirée de tout ce qui s'affiche, gardée seulement dans ar / exAr.
const AR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g;
const noAr = s => String(s ?? "").replace(AR_RE, "").replace(/\(\s*\)|«\s*»|"\s*"/g, "").replace(/[ \t]{2,}/g, " ").replace(/ +([,.])/g, "$1").trim();
const onlyAr = s => { const t = String(s ?? "").trim(); return /[\u0600-\u06FF]/.test(t) ? t : ""; };

// ---------- Synchronisation : « le plus récent gagne », mot par mot ----------
function merge(a, b) {
  const byId = new Map();
  for (const e of [...a, ...b]) {
    if (!e || typeof e.id !== "string") continue;
    const cur = byId.get(e.id);
    if (!cur || (Number(e.updatedAt) || 0) > (Number(cur.updatedAt) || 0)) byId.set(e.id, e);
  }
  return [...byId.values()];
}
function clean(e) {
  const s = (v, n) => String(v ?? "").slice(0, n);
  const id = s(e?.id, 64), updatedAt = Number(e?.updatedAt) || 0;
  if (!id) return null;
  if (e.deleted) return { id, deleted: true, updatedAt };
  return {
    id, en: s(e.en, 2000), fr: s(e.fr, 2000), note: s(e.note, 2000),
    exEn: s(e.exEn, 1000), exFr: s(e.exFr, 1000), tip: s(e.tip, 1000), folder: s(e.folder, 64),
    ar: s(e.ar, 2000), exAr: s(e.exAr, 1000),
    origin: e.origin === "fr" ? "fr" : "en", status: e.status === "learned" ? "learned" : "new",
    createdAt: Number(e.createdAt) || updatedAt, updatedAt,
  };
}

function cleanFolder(f) {
  const s = (v, n) => String(v ?? "").slice(0, n);
  const id = s(f?.id, 64), updatedAt = Number(f?.updatedAt) || 0;
  if (!id) return null;
  if (f.deleted) return { id, deleted: true, updatedAt };
  return { id, name: s(f.name, 60), emoji: s(f.emoji, 16), updatedAt };
}
async function mergeKey(env, key, incoming) {
  let stored = [];
  try { stored = JSON.parse((await env.WORDS.get(key)) || "[]"); } catch { stored = []; }
  const merged = merge(stored, incoming);
  const sig = l => JSON.stringify(l.map(e => [e.id, e.updatedAt]).sort());
  if (sig(stored) !== sig(merged)) await env.WORDS.put(key, JSON.stringify(merged));
  return merged;
}

// ---------- Darija : règles communes à toutes les consignes ----------
const DARIJA_STYLE = `About Darija:
- Use everyday spoken Moroccan Darija as people really speak it, never Modern Standard or classical Arabic (no fus-ha words when a common Darija word exists).
- When a word or expression differs between regions, use the one most common in Casablanca and Rabat, and mention the regional variant.`;
const SPELLING = `Darija spelling: Latin letters and digits only, the way Moroccans write on WhatsApp. NEVER use Arabic script in Darija text. Be strictly consistent: the same word must always be spelled exactly the same way. Rules:
- 3 = ع, 7 = ح, 9 = ق, 2 = ء (only when clearly pronounced; usually omitted), kh = خ, gh = غ, ch = ش, j = ج, y = ي (consonant), w = و (consonant), h = ه. Emphatic ص ط ض ظ are written s, t, d, d; ث is t and ذ is d. Never use "sh", "q", "x", "5", "8", "ou" or "u".
- Vowels: write only a, i, o, e. Use "o" for every o/u sound (chokran, howa, kol, nta, ntoma). Use "i" for every i sound. Use "a" for every a sound, including the final -ak (3afak, m3ak). Short neutral vowels (schwa) are not written unless the word becomes unreadable (ktab, bghit, mzyan, bslama, ghda, lbar7).
- Write a doubled letter only when the doubling changes the meaning.
- The article is attached, without hyphen or apostrophe: lma, lkhobz, ddar, lmdina. No hyphens or apostrophes inside words.
- Lowercase, except a capital at the start of a full sentence and for proper names.
- Reference spellings (always use exactly these): salam, labas, bikhir, l7amdolillah, chokran, 3afak, bslama, wakha, safi, iyeh, la, mzyan, bzaf, chwiya, walo, daba, ghda, lbar7, lyoma, dyal, dyali, dyalek, dyalo, dyalha, dyalna, dyalkom, dyalhom, ana, nta, nti, howa, hiya, 7na, ntoma, homa, chno, ach, kifach, fin, mnin, fo9ach, 3lach, chkon, chi, kayn, kayna, makaynch, bghit, bgha, khassni, ghadi, kan, kont, wach, ila, 7it, 7ta, m3a, 3and, 3andi, 3la, mn, f, l, had, hadi, hadak, hadchi, bach, hna, tema. (So: never "bezzaf", "choukran", "3afek", "mezyan", "dial".)
- If the user writes a Darija word with another spelling, understand it, but write it the standard way above in your own text.`;

// ---------- Traduction avec Claude ----------
function claudePrompt(source, folders) {
  const fromFr = source === "FR";
  return `You are a translation assistant for a French speaker who is learning Moroccan Arabic (Darija).
Translate the user's text from ${fromFr ? "French into Moroccan Darija" : "Moroccan Darija into French"}.
${DARIJA_STYLE}
${SPELLING}
Rules:
- Translate faithfully and completely. Keep the meaning, tone and register. Do not add or drop information.
- Prefer the phrasing a Moroccan would naturally use (expressions over word-for-word).
- If a "Context" is given, use it only to pick the right meaning. Never translate or include the context itself.
- Reply with ONLY a JSON object, no other text, in exactly this shape:
{"translation": "...", "alternatives": ["..."], "darija_ar": "...", "alternatives_ar": ["..."], "example_darija": "...", "example_ar": "...", "example_fr": "...", "note": "..."}
- "translation": ${fromFr ? "the Darija translation, in Latin script" : "the French translation"}.
- "alternatives": 0 to 2 other natural translations, only if they are genuinely different and correct; otherwise [].${fromFr ? " In Latin script." : ""}
- "darija_ar": ${fromFr ? "the Darija translation" : "the user's Darija text"} written in Arabic script, the way Moroccans write Darija in Arabic letters, without diacritics. It is only fed to a text-to-speech voice and never shown.
- "alternatives_ar": ${fromFr ? "each alternative written in Arabic script, same order as \"alternatives\"" : "[]"}.
- "example_darija": one short, natural, everyday Darija sentence that uses the Darija expression, in Latin script.
- "example_ar": the same example sentence written in Arabic script (for the voice only).
- "example_fr": the French translation of example_darija.
- "note": one short sentence in French on usage, register, a common pitfall, or a regional difference (e.g. "Au Nord, on dit plutôt …"). Use "" if there is nothing useful to say. No Arabic script.
- Only "darija_ar", "alternatives_ar" and "example_ar" may contain Arabic letters.` +
  (folders.length ? `
- Also add "folder": the name of the ONE folder below that clearly fits this text's topic, copied exactly, or "" if none clearly fits. Folders: ${JSON.stringify(folders)}` : "");
}
function parseJsonObject(t) {
  const i = t.indexOf("{"), j = t.lastIndexOf("}");
  if (i < 0 || j <= i) throw new Error("bad json");
  return JSON.parse(t.slice(i, j + 1));
}
function claudeError(status, msg) {
  return status === 401 ? "clé Claude refusée"
       : /credit balance/i.test(msg) ? "crédit Claude épuisé"
       : status === 429 ? "trop de demandes d'affilée"
       : status === 529 || status >= 500 ? "Claude est surchargé" : `erreur Claude ${status}`;
}
async function callClaude(env, model, payload) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_KEY.trim(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: model.trim(), ...payload }),
  });
  if (!res.ok) {
    let msg = ""; try { msg = (await res.json())?.error?.message || ""; } catch {}
    throw new Error(claudeError(res.status, msg));
  }
  const data = await res.json();
  return (data?.content || []).map(c => c.text || "").join("");
}
async function translateClaude(env, { text, source, context, folders }) {
  const raw = await callClaude(env, env.CLAUDE_MODEL || DEFAULT_MODEL, {
    max_tokens: 900, temperature: 0,
    system: claudePrompt(source, folders),
    messages: [{ role: "user", content: (context ? `Context: ${context}\n\n` : "") + `Text to translate:\n${text}` }],
  });
  const j = parseJsonObject(raw);
  const str = (v, n) => noAr(String(v ?? "").slice(0, n * 2)).slice(0, n);
  const translation = str(j.translation, 2000);
  if (!translation) throw new Error("réponse Claude vide");
  const alts = Array.isArray(j.alternatives) ? j.alternatives : [];
  const altsAr = Array.isArray(j.alternatives_ar) ? j.alternatives_ar : [];
  const pairs = alts.map((a, i) => [str(a, 500), onlyAr(altsAr[i]).slice(0, 500)])
    .filter(([a]) => a && a !== translation).slice(0, 2);
  return {
    translation,
    alternatives: pairs.map(p => p[0]),
    alternativesAr: pairs.map(p => p[1]),
    ar: onlyAr(j.darija_ar).slice(0, 2000),
    example: str(j.example_darija, 500), exampleAr: onlyAr(j.example_ar).slice(0, 500), exampleFr: str(j.example_fr, 500),
    note: str(j.note, 300),
    folder: folders.includes(str(j.folder, 60)) ? str(j.folder, 60) : "",
    engine: "claude",
  };
}

// ---------- Écriture arabe à la demande (pour la voix des mots ajoutés à la main) ----------
async function scriptClaude(env, texts) {
  const system = `You convert Moroccan Darija written in Latin letters and digits (WhatsApp style: 3 = ع, 7 = ح, 9 = ق, 2 = ء, kh = خ, gh = غ, ch = ش) into Arabic script, the way Moroccans write Darija in Arabic letters, without diacritics. The result is only fed to a text-to-speech voice.
Keep the Darija words as they are (do not translate them into classical Arabic). If a text is French or not Darija, return "".
Reply with ONLY a JSON object, no other text: {"ar": ["...", "..."]} with one item per input text, in the same order.`;
  const raw = await callClaude(env, env.CLAUDE_MODEL || DEFAULT_MODEL, {
    max_tokens: 1500, temperature: 0, system,
    messages: [{ role: "user", content: "Texts:\n" + JSON.stringify(texts) }],
  });
  const j = parseJsonObject(raw);
  const list = Array.isArray(j.ar) ? j.ar : [];
  return { ar: texts.map((_, i) => onlyAr(list[i]).slice(0, 2000)) };
}

// ---------- Tri automatique des mots dans des dossiers (Claude) ----------
async function sortWithClaude(env, words, folders, hint) {
  const system = `You organise the vocabulary notebook of a French speaker who is learning Moroccan Arabic (Darija) into topic folders.
Existing folders (name and emoji): ${JSON.stringify(folders)}
The user's wishes: ${hint ? JSON.stringify(hint) : "(none)"}
Rules:
- Put EVERY word into exactly one folder.
- Prefer existing folders. Create a new folder only if the user asked for it, or if at least 3 words clearly share a topic that no existing folder covers. At most 6 new folders.
- New folder names: short, in French, capitalised (e.g. "Conjugaison", "Cuisine"), each with one fitting emoji.
- Grammar items (verb tenses, conjugated verb forms, pronouns, negation) belong in a grammar folder such as "Conjugaison" when one exists or is requested.
- Use a catch-all folder like "Divers" only for words that fit nowhere else.
- Reply with ONLY a JSON object, no other text:
{"new_folders":[{"name":"...","emoji":"..."}],"assign":[[0,"Folder name"],[1,"Folder name"]]}
where each number is the word's index in the list below and each folder name is copied exactly from the existing or new folders.`;
  const list = words.map((w, i) => `${i}. ${w.en} = ${w.fr}${w.note ? " (" + w.note + ")" : ""}`).join("\n");
  const raw = await callClaude(env, env.CLAUDE_MODEL || DEFAULT_MODEL, { max_tokens: 8000, system, messages: [{ role: "user", content: "Words (Darija = French):\n" + list }] });
  const j = parseJsonObject(raw);
  const str = (v, n) => String(v ?? "").trim().slice(0, n);
  const newFolders = (Array.isArray(j.new_folders) ? j.new_folders : []).slice(0, 6)
    .map(f => ({ name: noAr(str(f?.name, 40)), emoji: str(f?.emoji, 8) })).filter(f => f.name);
  const valid = new Set([...folders.map(f => f.name), ...newFolders.map(f => f.name)]);
  const assign = (Array.isArray(j.assign) ? j.assign : [])
    .filter(a => Array.isArray(a) && Number.isInteger(a[0]) && a[0] >= 0 && a[0] < words.length && valid.has(str(a[1], 40)))
    .map(a => [a[0], str(a[1], 40)]);
  return { newFolders, assign };
}

// ---------- Onglet Prof : discussion et leçons ----------
function cleanLesson(l) {
  const s = (v, n) => String(v ?? "").slice(0, n);
  const id = s(l?.id, 64), updatedAt = Number(l?.updatedAt) || 0;
  if (!id) return null;
  if (l.deleted) return { id, deleted: true, updatedAt };
  return { id, title: s(l.title, 120), emoji: s(l.emoji, 16), body: s(l.body, 20000), createdAt: Number(l.createdAt) || updatedAt, updatedAt };
}
function cleanChat(list) {
  const out = [];
  for (const m of (Array.isArray(list) ? list : []).slice(-24)) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const content = String(m?.content ?? "").trim().slice(0, 6000);
    if (!content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}
async function askClaude(env, system, messages, maxTokens) {
  const raw = await callClaude(env, env.PROF_MODEL || env.CLAUDE_MODEL || DEFAULT_MODEL, { max_tokens: maxTokens, system, messages });
  return raw.trim();
}
const PROF_STYLE = `Formatting: the answer is read on a phone. Use short paragraphs, "- " bullet lists, **bold** for key words, and "### " for small headings if useful. No tables, no code blocks. Write Darija examples in *italics* (Latin script) followed by their French translation in parentheses. Never write Arabic script, even if the user does.`;
async function profChat(env, messages) {
  const system = `You are a friendly, precise teacher of Moroccan Arabic (Darija) for a French speaker who is learning it (beginner to intermediate).
Always answer in French (Darija only for examples). Answer the question directly and concisely: usually 3 to 10 lines, with 1 to 3 short examples. Explain the "why" simply, and mention common mistakes French speakers make when relevant. If the user writes in Darija, you may also gently correct their Darija.
${DARIJA_STYLE}
${SPELLING}
${PROF_STYLE}
When the question is about a rule, a notion, a conjugation, a difference between words or anything worth keeping as a short lesson (or when the user asks for a lesson), end your answer with one short sentence offering to turn it into a lesson for their course notebook, then put the tag [LEÇON] alone on the last line. Do not add the tag for small talk or trivial questions.`;
  let reply = noAr(await askClaude(env, system, messages, 1200));
  const offer = /\[LE[ÇC]ON\]/i.test(reply);
  reply = reply.replace(/\s*\[LE[ÇC]ON\]\s*/gi, "\n").trim();
  if (!reply) throw new Error("réponse Claude vide");
  return { reply, offer };
}
async function profLesson(env, messages) {
  const system = `You are a teacher of Moroccan Arabic (Darija) for a French speaker. From the conversation, write a short lesson (in French, with Darija examples) about the notion discussed, to be kept in the learner's course notebook and re-read later.
Structure: a one-line summary of the rule, then "### " sections such as "La règle", "Quand l'utiliser", "Exemples", "Pièges à éviter", "À retenir". Include 4 to 8 example sentences. Keep it compact: 150 to 400 words.
${DARIJA_STYLE}
${SPELLING}
${PROF_STYLE}
Reply in exactly this format and nothing else:
TITRE: <short French title, max 60 characters>
EMOJI: <one emoji>
---
<the lesson>`;
  const conv = messages.map(m => (m.role === "user" ? "Élève : " : "Prof : ") + m.content).join("\n\n");
  const raw = await askClaude(env, system, [{ role: "user", content: "Conversation :\n\n" + conv + "\n\nÉcris la leçon." }], 2000);
  const sep = raw.indexOf("\n---");
  const head = sep >= 0 ? raw.slice(0, sep) : "", body = noAr(sep >= 0 ? raw.slice(sep + 4) : raw);
  const title = noAr(head.match(/TITRE\s*:\s*(.+)/i)?.[1] || "Leçon").slice(0, 120) || "Leçon";
  const emoji = (head.match(/EMOJI\s*:\s*(\S+)/i)?.[1] || "📘").trim().slice(0, 16);
  if (!body) throw new Error("leçon vide");
  return { title, emoji, body: body.slice(0, 20000) };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    let allowed = "*";
    if (env.ALLOWED_ORIGIN) { try { allowed = new URL(env.ALLOWED_ORIGIN.trim()).origin; } catch { allowed = "*"; } }
    const cors = {
      "Access-Control-Allow-Origin": allowed === "*" ? "*" : allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-App-Password",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply(405, { error: "method", message: "Utilise POST." });
    if (allowed !== "*" && origin && origin !== allowed) {
      return reply(403, { error: "origin", message: "Cette adresse n'est pas autorisée." });
    }
    if (!env.APP_PASSWORD || request.headers.get("X-App-Password") !== env.APP_PASSWORD) {
      return reply(401, { error: "password", message: "Mot de passe incorrect." });
    }

    let body;
    try { body = await request.json(); } catch { return reply(400, { error: "body", message: "Requête illisible." }); }

    // Test de connexion : dit ce qui est configuré, sans rien consommer.
    if (body && body.ping) return reply(200, { ok: true, app: "kalima-up", sync: !!env.WORDS, claude: !!env.ANTHROPIC_KEY });

    // ---------- Synchronisation ----------
    if (body && body.sync) {
      if (!env.WORDS) return reply(501, { error: "no_kv", message: "Synchronisation pas encore activée : ajoute la liaison WORDS dans Cloudflare." });
      const incoming = Array.isArray(body.entries) ? body.entries.slice(0, MAX_ENTRIES).map(clean).filter(Boolean) : [];
      const incomingF = Array.isArray(body.folders) ? body.folders.slice(0, 500).map(cleanFolder).filter(Boolean) : [];
      const entries = await mergeKey(env, KEY, incoming);
      const folders = await mergeKey(env, FKEY, incomingF);
      const incomingL = Array.isArray(body.lessons) ? body.lessons.slice(0, 2000).map(cleanLesson).filter(Boolean) : [];
      const lessons = await mergeKey(env, LKEY, incomingL);
      return reply(200, { entries, folders, lessons, serverTime: Date.now() });
    }

    if (!env.ANTHROPIC_KEY) return reply(500, { error: "config", message: "Clé Claude manquante : ajoute ANTHROPIC_KEY dans Cloudflare." });

    // ---------- Onglet Prof ----------
    if (body && (body.chat || body.lesson)) {
      const messages = cleanChat(body.messages);
      if (!messages.length) return reply(400, { error: "empty", message: "Écris d'abord ta question." });
      try { return reply(200, body.lesson ? await profLesson(env, messages) : await profChat(env, messages)); }
      catch (e) { return reply(502, { error: "claude", message: (body.lesson ? "Leçon impossible : " : "Claude ne répond pas : ") + (e.message || "indisponible") + "." }); }
    }

    // ---------- Tri automatique ----------
    if (body && body.sortWords) {
      const words = (Array.isArray(body.words) ? body.words : []).slice(0, 400)
        .map(w => ({ en: String(w?.en || "").slice(0, 200), fr: String(w?.fr || "").slice(0, 200), note: String(w?.note || "").slice(0, 100) }));
      const folders = (Array.isArray(body.folders) ? body.folders : []).slice(0, 50)
        .map(f => ({ name: String(f?.name || "").slice(0, 40), emoji: String(f?.emoji || "").slice(0, 8) })).filter(f => f.name);
      if (!words.length) return reply(400, { error: "empty", message: "Aucun mot à trier." });
      try { return reply(200, await sortWithClaude(env, words, folders, String(body.hint || "").slice(0, 300))); }
      catch (e) { return reply(502, { error: "claude", message: "Tri impossible : " + (e.message || "Claude indisponible") + "." }); }
    }

    // ---------- Écriture arabe pour la voix ----------
    if (body && body.script) {
      const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, 20).map(t => String(t || "").slice(0, 500));
      if (!texts.some(t => t.trim())) return reply(400, { error: "empty", message: "Rien à lire." });
      try { return reply(200, await scriptClaude(env, texts)); }
      catch (e) { return reply(502, { error: "claude", message: "Lecture impossible : " + (e.message || "Claude indisponible") + "." }); }
    }

    // ---------- Traduction ----------
    const req = {
      text: String(body?.text || "").trim(),
      source: String(body?.source || "").toUpperCase(),
      target: String(body?.target || "").toUpperCase(),
      context: String(body?.context || "").slice(0, 500),
      folders: (Array.isArray(body?.folders) ? body.folders : []).map(f => String(f).slice(0, 60)).filter(Boolean).slice(0, 50),
    };
    if (!req.text) return reply(400, { error: "empty", message: "Rien à traduire." });
    if (req.text.length > MAX_CHARS) return reply(400, { error: "long", message: `Texte trop long (max ${MAX_CHARS} caractères).` });
    const okPair = (req.source === "FR" && req.target === "DARIJA") || (req.source === "DARIJA" && req.target === "FR");
    if (!okPair) return reply(400, { error: "lang", message: "Langues non prises en charge." });
    try { return reply(200, await translateClaude(env, req)); }
    catch (e) { return reply(502, { error: "claude", message: "Traduction impossible : " + (e.message || "Claude indisponible") + "." }); }
  },
};
