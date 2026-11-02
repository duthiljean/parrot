// Copie toute la transcription ouverte dans l'application Microsoft Teams (Mac).
// Teams n'affiche que les répliques proches de l'endroit où l'on se trouve : le programme
// lit le panneau « Transcription » via l'accessibilité de macOS, le fait défiler du début
// à la fin, met le texte complet dans le presse-papiers et affiche widget.js.
//
// Lancé par l'application « Parrot » (qui charge widget.js puis ce fichier).
// Test :  osascript -l JavaScript transcription-teams-app.js --debug
// (nécessite l'autorisation Réglages > Confidentialité et sécurité > Accessibilité)

function run(argv) {
  const tStart = Date.now();
  if (!Array.isArray(argv)) argv = []; // lancé comme application : pas d'options
  const debug = argv.indexOf('--debug') >= 0;
  const app = Application.currentApplication();
  app.includeStandardAdditions = true;
  const se = Application('System Events');
  // Journal de la dernière copie (heures et nombres seulement, jamais le texte des répliques),
  // pour comprendre un problème après coup
  const journal = [];
  const log = (m) => { if (debug) console.log(m); else journal.push(`${((Date.now() - tStart) / 1000).toFixed(1)} s  ${m}`); };
  ObjC.import('ApplicationServices');
  ObjC.import('AppKit');

  // Dossier de données partagé avec « Parrot Widget »
  const DATA = $.NSHomeDirectory().js + '/Library/Application Support/Transcription Teams/';
  const writeFile = (name, text) => $(text).writeToFileAtomicallyEncodingError($(DATA + name), true, $.NSUTF8StringEncoding, null);
  const readFile = (name) => { const s = $.NSString.stringWithContentsOfFileEncodingError($(DATA + name), $.NSUTF8StringEncoding, null); return s.isNil() ? null : s.js; };
  const WIDGET_PROCESS = "'[P]arrot Widget.app/Contents/MacOS'"; // [P] : le motif ne se reconnaît pas lui-même
  const appPath = $.NSBundle.mainBundle.bundlePath.js;

  // Parrot a été relancé par le widget pour coller le texte : il ne fait que ça
  if (!debug) {
    const pending = readFile('action.json');
    if (pending) {
      $.NSFileManager.defaultManager.removeItemAtPathError($(DATA + 'action.json'), null);
      let action = null;
      try { action = JSON.parse(pending); } catch (e) {}
      // Une demande ancienne (plantage, etc.) ne doit surtout pas partir toute seule plus tard
      if (action && Date.now() - action.at < 20000) return pasteIntoAssistant(action.target);
    }
  }

  // Colle le presse-papiers dans une nouvelle conversation, sans l'envoyer. Avant chaque touche,
  // on vérifie que la bonne app est devant : sinon le texte irait n'importe où.
  function pasteIntoAssistant(target) {
    const apps = { claude: { name: 'Claude', url: 'https://claude.ai/new' }, chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com' } };
    const t = apps[target];
    if (!t) return 'assistant inconnu';
    try {
      app.doShellScript(`open -a ${t.name}`);
    } catch (e) {
      app.doShellScript(`open ${t.url}`); // app non installée : le texte reste à coller à la main
      return 'site ouvert';
    }
    const proc = se.processes.byName(t.name);
    const front = () => { try { return proc.frontmost(); } catch (e) { return false; } };
    const stop = () => {
      try { app.activate(); } catch (e) {}
      app.displayDialog(`Collage annulé : ${t.name} n'est plus au premier plan. Le texte est dans le presse-papiers, colle-le avec ⌘V.`, { withTitle: 'Parrot', buttons: ['OK'], defaultButton: 'OK', withIcon: 'caution' });
      return 'collage annulé';
    };
    for (let k = 0; k < 160 && !front(); k++) delay(0.05);
    if (!front()) return stop();
    delay(0.6);
    se.keystroke('n', { using: 'command down' }); // nouvelle conversation
    delay(1.2);
    if (!front()) return stop();
    se.keystroke('v', { using: 'command down' });
    return 'collé'; // l'envoi reste à la main : on n'appuie jamais sur Entrée
  }

  // Suivi affiché par le widget
  const report = (s) => { if (!debug) writeFile('etat.json', JSON.stringify(Object.assign({ app: appPath, t: Date.now() }, s))); };
  if (!debug) {
    report({ state: 'start', label: 'Parrot démarre…' });
    // -g : le widget ne prend pas le premier plan, sinon macOS quitterait le bureau plein écran
    // de Teams et sa fenêtre deviendrait invisible pour Parrot
    try { app.doShellScript(`pkill -f ${WIDGET_PROCESS} ; open -g -n ${JSON.stringify(DATA + 'Parrot Widget.app')}`); } catch (e) {}
  }

  const fail = (msg) => {
    if (debug) return 'ERREUR: ' + msg;
    journal.push('erreur : ' + msg.split('\n')[0]); writeFile('journal.txt', journal.join('\n'));
    report({ state: 'error', message: msg });
    try {
      app.doShellScript(`pgrep -f ${WIDGET_PROCESS}`); // le widget affiche l'erreur
    } catch (e) {
      try { app.activate(); } catch (e2) {}
      app.displayDialog(msg, { withTitle: 'Parrot', buttons: ['OK'], defaultButton: 'OK', withIcon: 'caution' });
    }
    return msg;
  };

  // Accessibilité : si l'autorisation manque, macOS affiche sa propre fenêtre pour la demander
  const prompt = $.NSDictionary.dictionaryWithObjectForKey($.kCFBooleanTrue, $('AXTrustedCheckOptionPrompt'));
  if (!$.AXIsProcessTrustedWithOptions(prompt)) {
    return fail("Il faut autoriser Parrot une fois.\n\nmacOS vient d'afficher une fenêtre : clique sur « Ouvrir Réglages Système », active « Parrot » dans Accessibilité, puis relance.");
  }

  // Vérifier qu'on a bien le droit de lire les fenêtres (contrôle de System Events)
  let teamsRunning;
  try {
    teamsRunning = se.processes.whose({ name: 'MSTeams' }).length > 0;
    if (teamsRunning) se.processes.byName('MSTeams').windows.length;
  } catch (e) {
    return fail("macOS bloque l'accès à Teams :\n" + e.message +
      "\n\nRéglages > Confidentialité et sécurité :\n• Accessibilité : « Parrot » activé\n• Automatisation : « Parrot » → « System Events » activé");
  }
  if (!teamsRunning) return fail("Microsoft Teams n'est pas ouvert.");
  // Mettre Teams au premier plan (sans passer par AppleScript, pour éviter une autorisation de plus).
  // Si macOS refuse (règles d'activation récentes), on passe par « open », qui marche toujours.
  const proc = se.processes.byName('MSTeams');
  const teamsReady = () => { try { return proc.frontmost() && proc.windows.length > 0; } catch (e) { return false; } };
  try {
    const teamsApp = $.NSRunningApplication.runningApplicationsWithBundleIdentifier($('com.microsoft.teams2')).firstObject;
    if (teamsApp && !teamsApp.isNil()) teamsApp.activateWithOptions(1 << 1); // NSApplicationActivateIgnoringOtherApps
  } catch (e) {}
  for (let k = 0; k < 10 && !teamsReady(); k++) delay(0.05);
  if (!teamsReady()) {
    try { app.doShellScript('open -b com.microsoft.teams2'); } catch (e) {}
    for (let k = 0; k < 30 && !teamsReady(); k++) delay(0.05);
  }
  if (!teamsReady()) return fail("Impossible d'afficher la fenêtre de Teams (écran verrouillé ou fenêtre fermée ?). Ouvre Teams sur la transcription, puis relance.");

  // Sans ce réglage, Teams n'expose pas le contenu de ses pages à l'accessibilité
  try { proc.attributes.byName('AXEnhancedUserInterface').value = true; } catch (e) {}

  const UNIT = '(?:heures?|hours?|minutes?|secondes?|seconds?)';
  const TIME_RE = new RegExp('\\d+\\s+' + UNIT, 'i');
  const ONLY_TIME_RE = new RegExp('^(?:\\d+\\s+' + UNIT + '\\s*)+$', 'i');
  const HEADER_RE = new RegExp('^(.*?)\\s+((?:\\d+\\s+' + UNIT + '\\s*)+)$', 'i');

  const flat = (x) => (Array.isArray(x) ? x.flatMap(flat) : [x]);
  const strings = (x) => flat(x).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());

  // ---------- Trouver la liste de la transcription ----------
  // Au moins deux vraies lignes de transcription « Nom 2 minutes 40 secondes » (une conversation
  // qui contient « il y a 5 minutes » ne suffit pas)
  const LINE_RE = new RegExp('^\\S.*\\s(?:\\d+\\s+(?:heures?|hours?|minutes?)\\s+)*\\d+\\s+(?:secondes?|seconds?)$', 'i');
  function looksLikeTranscript(list) {
    try {
      return strings(list.uiElements.uiElements.uiElements.description()).filter((l) => LINE_RE.test(l)).length >= 2;
    } catch (e) { return false; }
  }

  // Renvoie le chemin (indices successifs) de la liste dans la fenêtre
  // (la recherche s'arrête après 12 s : mieux vaut un message d'erreur qu'une longue attente)
  report({ state: 'progress', label: 'Recherche de la transcription…', detail: '' });
  const searchDeadline = Date.now() + 12000;
  function findList(root, depth, path) {
    if (depth > 45 || Date.now() > searchDeadline) return null;
    let kids, roles;
    try { kids = root.uiElements; roles = kids.role(); } catch (e) { return null; }
    for (let i = 0; i < roles.length; i++) {
      if (roles[i] === 'AXList' && looksLikeTranscript(kids[i])) return path.concat(i);
    }
    for (let i = 0; i < roles.length; i++) {
      if (roles[i] === 'AXStaticText' || roles[i] === 'AXButton' || roles[i] === 'AXImage') continue;
      const found = findList(kids[i], depth + 1, path.concat(i));
      if (found) return found;
    }
    return null;
  }
  // path = [n° de fenêtre, puis indices successifs jusqu'à la liste]
  const atPath = (path) => path.slice(1).reduce((el, i) => el.uiElements[i], proc.windows[path[0]]);

  // Chemin mémorisé la dernière fois : évite de parcourir toute la fenêtre de Teams
  const CACHE = $.NSHomeDirectory().js + '/Library/Application Support/Transcription Teams/chemin.json';
  let list = null, listWindow = 0, listPath = [];
  try {
    const saved = $.NSString.stringWithContentsOfFileEncodingError($(CACHE), $.NSUTF8StringEncoding, null);
    if (!saved.isNil()) {
      const path = JSON.parse(saved.js);
      const el = atPath(path);
      if (el.role() === 'AXList' && looksLikeTranscript(el)) { list = el; listWindow = path[0]; listPath = path; }
    }
  } catch (e) {}

  // Sinon on cherche dans toutes les fenêtres de Teams ; son arbre d'accessibilité se
  // construit progressivement, on réessaie quelques fois
  for (let k = 0; k < 6 && !list && Date.now() < searchDeadline; k++) {
    if (!teamsReady()) { try { app.doShellScript('open -b com.microsoft.teams2'); } catch (e) {} delay(0.6); }
    let nWin = 0;
    try { nWin = proc.windows.length; } catch (e) {}
    for (let w = 0; w < nWin && !list; w++) {
      let path = null;
      try { path = findList(proc.windows[w], 0, [w]); } catch (e) {}
      if (path) {
        list = atPath(path);
        listWindow = w;
        listPath = path;
        $(JSON.stringify(path)).writeToFileAtomicallyEncodingError($(CACHE), true, $.NSUTF8StringEncoding, null);
      }
    }
    if (!list) delay(1.5);
  }
  if (!list) return fail("Je ne trouve pas la transcription.\n\nDans Teams, ouvre la réunion puis l'onglet « Transcription », et relance.");
  let meetingTitle = '';
  try { meetingTitle = proc.windows[listWindow].name() || ''; } catch (e) {}

  // « 2 minutes 40 secondes » -> 160
  function toSeconds(s) {
    let t = 0;
    s.replace(new RegExp('(\\d+)\\s+(' + UNIT + ')', 'gi'), (_, n, u) => {
      t += +n * (/^h/i.test(u) ? 3600 : /^m/i.test(u) ? 60 : 1);
    });
    return t;
  }
  const fmt = (t) => {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = String(t % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };

  // ---------- Lecture de toutes les répliques affichées, en quelques requêtes groupées ----------
  // Dernière ligne d'une transcription Teams : « … transcription arrêtée ». Elle peut aussi
  // apparaître au milieu (transcription arrêtée puis relancée) : seule compte la toute dernière.
  const END_RE = /transcription (arrêtée|stopped)|a arrêté la transcription|stopped transcription/i;
  const entries = new Map();
  let retries = 0;
  let seq = 0;

  const L3 = list.uiElements.uiElements.uiElements;
  const readLabels = () => { try { return L3.description(); } catch (e) { return null; } };

  // known : étiquettes déjà lues juste avant (évite une requête)
  function readVisible(known) {
    // Les étiquettes et les textes arrivent en plusieurs requêtes : si Teams a déplacé
    // les répliques entre-temps, ils ne correspondent plus. On relit dans ce cas.
    let labels, labelsJSON, d4, d5, d6 = [], stable = false;
    for (let attempt = 0; attempt < 5 && !stable; attempt++) {
      try {
        labels = attempt === 0 && known ? known : L3.description();
        d4 = L3.uiElements.value();
        d5 = L3.uiElements.uiElements.value();
        labelsJSON = JSON.stringify(labels);
        stable = JSON.stringify(L3.description()) === labelsJSON;
      } catch (e) {}
      if (!stable) { retries++; delay(0.1); }
    }
    if (!stable) {
      log('lecture instable, ignorée');
      return { added: 0, min: null, max: null, lastIdx: -1, moving: true };
    }
    let added = 0, lastTime = 0, min = null, max = null, firstIdx = -1, lastIdx = -1, lastText = '', pending = 0;
    const times = [], slotOf = [], speakers = [];
    for (let i = 0; i < labels.length; i++) {
      let speaker = '', time = null;
      for (const l of strings(labels[i])) {
        const m = l.match(HEADER_RE);
        if (m) { speaker = m[1].trim(); time = toSeconds(m[2]); break; }
      }
      const texts = strings([d4[i], d5[i], d6[i]]).filter((v) => v !== speaker && !ONLY_TIME_RE.test(v) && !HEADER_RE.test(v));
      if (!speaker && texts.length > 1) speaker = texts.shift(); // ex. « Marie Dupont » + « transcription démarrée »
      const text = texts.join(' ').replace(/\s+/g, ' ').trim();
      if (!text) { if (speaker || time != null) pending++; continue; } // réplique pas encore chargée
      if (time == null) time = lastTime; else lastTime = time;
      times.push(time);
      slotOf.push(i);
      if (speaker) speakers.push({ i, name: speaker });
      if (min == null || time < min) { min = time; firstIdx = i; }
      if (max == null || time >= max) { max = time; lastIdx = i; lastText = text; }
      const key = time + '|' + speaker + '|' + text.slice(0, 30);
      const prev = entries.get(key);
      if (!prev) { entries.set(key, { time, speaker, text, seq: seq++ }); added++; }
      else if (text.length > prev.text.length) prev.text = text;
    }
    log(`lecture : ${labels.length} emplacements, ${fmt(min || 0)}-${fmt(max || 0)}, +${added}, total ${entries.size}${pending ? `, ${pending} en chargement` : ''}`);
    // Début de la fenêtre autour de la ligne sélectionnée (après le plus grand saut d'heure)
    // et fin du morceau continu qui part du début
    let windowStart = times.length ? times[0] : 0, contigEnd = max, contigIdx = lastIdx, jump = 0;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] > jump) {
        jump = times[i] - times[i - 1];
        if (jump > 120) windowStart = times[i];
        if (jump > 300) { contigEnd = times[i - 1]; contigIdx = slotOf[i - 1]; }
      }
    }
    // Première ligne de la fenêtre autour de l'écran (après le début de réunion gardé en mémoire)
    let windowIdx = firstIdx;
    if (windowStart > (times[0] || 0)) windowIdx = slotOf[times.indexOf(windowStart)];
    return { added, min, max, firstIdx, lastIdx, windowStart, windowIdx, times, contigEnd, contigIdx, labelsJSON, slots: labels.length, endHere: END_RE.test(lastText), speakers, pending };
  }

  // ---------- Photos des intervenants ----------
  // Teams ne les expose pas à l'accessibilité : on découpe à l'écran la pastille de chaque
  // nouvel intervenant, si Parrot a l'autorisation Enregistrement de l'écran. Sinon, le widget
  // affiche les initiales.
  // Les photos déjà récupérées sont réutilisées d'une fois sur l'autre (fichier local).
  let photos = {};
  try { photos = JSON.parse(readFile('photos.json') || '{}'); } catch (e) {}
  // Sans l'autorisation, une capture renverrait le fond d'écran au lieu de la photo. Le test :
  // macOS ne donne le titre des fenêtres des autres apps qu'aux apps autorisées. Il n'est fait
  // que s'il manque une photo.
  let canCapture = null;
  function checkCapture() {
    try {
      ObjC.import('CoreGraphics');
      const pid = proc.unixId();
      return ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1, 0)))
        .some((w) => w.kCGWindowOwnerPID === pid && w.kCGWindowName);
    } catch (e) { return false; }
  }
  function grabPhotos(pass) {
    if (debug || !pass.speakers || pass.speakers.every((s) => photos[s.name])) return;
    if (canCapture === null) canCapture = checkCapture();
    if (!canCapture) return;
    let top, bottom;
    try { top = list.position()[1]; bottom = top + list.size()[1]; } catch (e) { return; }
    const tmp = DATA + 'photo-temporaire.png';
    for (const s of pass.speakers) {
      if (photos[s.name]) continue;
      try {
        const avatar = list.uiElements[s.i].uiElements[0].uiElements[0].uiElements[0].uiElements[0];
        const [x, y] = avatar.position(), [w, h] = avatar.size();
        if (w < 24 || h < 24 || y < top || y + h > bottom) continue; // ligne sans photo ou coupée
        app.doShellScript(`/usr/sbin/screencapture -x -R${x},${y},${w},${h} ${JSON.stringify(tmp)}`);
        const png = $.NSData.dataWithContentsOfFile($(tmp));
        if (!png.isNil()) photos[s.name] = 'data:image/png;base64,' + png.base64EncodedStringWithOptions(0).js;
      } catch (e) {}
    }
    $.NSFileManager.defaultManager.removeItemAtPathError($(tmp), null);
  }

  // ---------- Défilement ----------
  // Teams garde le début de la réunion en mémoire, plus une fenêtre autour de l'endroit
  // affiché. On demande à Teams d'afficher la dernière réplique lue (« faire défiler
  // jusqu'à »), ce qui charge les suivantes, et on recommence jusqu'à la fin.
  const arg = (name, def) => { const a = argv.find((x) => x.startsWith('--' + name + '=')); return a ? +a.split('=')[1] : def; };

  // Fait défiler puis attend juste le temps que Teams affiche les nouvelles répliques :
  // dès que les étiquettes ont changé puis ne bougent plus pendant deux relevés de suite
  // (Teams vide parfois la liste un instant avant de la remplir). Renvoie ces étiquettes,
  // ou null si rien n'a changé pendant maxWait secondes.
  function scrollTo(idx, beforeJSON, maxWait) {
    try { list.uiElements[idx].actions.byName('AXScrollToVisible').perform(); } catch (e) { return null; }
    const t = Date.now();
    let prev = beforeJSON, changed = false, same = 0;
    while (Date.now() - t < maxWait * 1000) {
      delay(0.05);
      const cur = readLabels();
      if (!cur) continue;
      const json = JSON.stringify(cur);
      if (json !== prev) { changed = true; prev = json; same = 0; continue; }
      if (changed && ++same >= 2) return cur;
    }
    return changed ? JSON.parse(prev) : null;
  }

  // Attend que la liste change puis se stabilise, sans la faire défiler nous-mêmes
  function waitChange(beforeJSON, maxWait) {
    const t = Date.now();
    let prev = beforeJSON, changed = false, same = 0;
    while (Date.now() - t < maxWait * 1000) {
      delay(0.05);
      const cur = readLabels();
      if (!cur) continue;
      const json = JSON.stringify(cur);
      if (json !== prev) { changed = true; prev = json; same = 0; continue; }
      if (changed && ++same >= 2) return cur;
    }
    return changed ? JSON.parse(prev) : null;
  }

  // Attend que la liste ne change plus pendant `calm` secondes (au plus maxWait secondes)
  function settle(calm, maxWait) {
    const t = Date.now();
    let prev = null, since = t;
    while (Date.now() - t < maxWait * 1000) {
      const json = JSON.stringify(readLabels());
      if (json !== prev) { prev = json; since = Date.now(); } else if (Date.now() - since >= calm * 1000) return;
      delay(0.1);
    }
  }

  const maxPasses = arg('max', 300);
  const t0 = Date.now();
  // Revenir au tout début : les étiquettes suffisent pour trouver la première réplique affichée
  const startLabels = readLabels() || [];
  let firstSlot = -1, firstTime = Infinity;
  startLabels.forEach((slot, i) => {
    for (const l of strings(slot)) {
      const m = l.match(HEADER_RE);
      if (m) { const t = toSeconds(m[2]); if (t < firstTime) { firstTime = t; firstSlot = i; } break; }
    }
  });
  if (firstSlot < 0) return fail('Impossible de lire la transcription. Fais défiler un peu la transcription dans Teams, puis relance.');
  const top = scrollTo(firstSlot, JSON.stringify(startLabels), 0.6);
  let r = readVisible(top || undefined);
  // Teams est peut-être encore en train d'afficher la transcription : on lui laisse le temps
  for (let w = 0; w < 4 && r.lastIdx < 0; w++) { settle(0.6, 3); r = readVisible(); }
  if (r.lastIdx < 0) return fail('Impossible de lire la transcription. Fais défiler un peu la transcription dans Teams, puis relance.');
  // Teams ramène la liste en haut quand il charge la suite d'une transcription qu'on vient
  // d'ouvrir, tant que personne ne l'a fait défiler soi-même. Le défilement par l'accessibilité
  // et les touches du clavier ne comptent pas pour lui : on fait donc comme quelqu'un, avec un
  // petit coup de molette au-dessus de la transcription. Si le pointeur n'y est pas déjà, il y
  // est placé le temps d'envoyer la molette (une fraction de seconde), puis remis où il était.
  ObjC.import('CoreGraphics');
  function humanScroll(idx, beforeJSON) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!teamsReady()) { log('geste molette : Teams pas au premier plan'); return null; }
      let home = null, away = 0;
      // Un petit défilement ne change pas toujours les répliques chargées : on regarde aussi si
      // la réplique visée a bougé à l'écran
      const posY = () => { try { return list.uiElements[idx].position()[1]; } catch (e) { return null; } };
      const y0 = posY();
      try {
        home = $.CGEventGetLocation($.CGEventCreate(null));
        const [x, y] = list.position(), [w, h] = list.size();
        const inside = home.x > x + 20 && home.x < x + w - 20 && home.y > y + 20 && home.y < y + h - 20;
        const at = inside ? home : $.CGPointMake(x + w / 2, y + h * 0.6);
        const t = Date.now();
        if (!inside) { $.CGWarpMouseCursorPosition(at); $.CGEventPost(0, $.CGEventCreateMouseEvent(null, 5, at, 0)); delay(0.03); }
        for (let i = 0; i < 2; i++) { // deux petits crans, comme une vraie molette
          const ev = $.CGEventCreateScrollWheelEvent2(null, 0, 1, -160, 0, 0);
          $.CGEventSetLocation(ev, at);
          $.CGEventPost(0, ev);
          delay(0.03);
        }
        if (!inside) { $.CGWarpMouseCursorPosition(home); $.CGEventPost(0, $.CGEventCreateMouseEvent(null, 5, home, 0)); away = Date.now() - t; }
        home = null;
      } catch (e) { log('geste molette impossible : ' + e.message); }
      if (home) $.CGWarpMouseCursorPosition(home);
      let moved = null;
      for (let k = 0; k < 12 && !moved; k++) {
        delay(0.05);
        const y = posY();
        if (y0 != null && y !== y0) moved = readLabels();
      }
      if (!moved) moved = waitChange(beforeJSON, 0.4);
      else { const later = waitChange(JSON.stringify(moved), 0.3); if (later) moved = later; }
      log(`geste molette : ${moved ? 'la liste a bougé' : 'rien n\'a bougé'} (essai ${attempt + 1}${away ? `, pointeur déplacé ${away} ms` : ', pointeur déjà sur la liste'})`);
      if (moved) return moved;
    }
    return null;
  }
  {
    const moved = humanScroll(r.firstIdx, r.labelsJSON);
    if (moved) { const again = readVisible(moved); if (again.lastIdx >= 0) r = again; }
  }
  // Si Teams garde encore d'anciennes lignes plus loin, repartir de la fin du morceau continu
  if (r.contigEnd < r.max) { r.lastIdx = r.contigIdx; r.endHere = false; }
  let cursor = r.contigEnd, holes = 0, jumps = 0;

  // Teams n'expose pas la durée réelle : le créneau prévu de la réunion (« 5 octobre 2026
  // 17:00 – 17:30 ») donne une estimation, plafonnée tant que la lecture n'est pas finie
  let scheduled = 0, meetingDate = '';
  try {
    const box = atPath(listPath.slice(0, -13).concat(0, 0));
    const m = String(box.value()).match(/^(.*?)\s+(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
    if (m) {
      meetingDate = m[1];
      scheduled = ((+m[4] * 60 + +m[5]) - (+m[2] * 60 + +m[3])) * 60;
      if (scheduled <= 0) scheduled += 86400;
    }
  } catch (e) {}
  const percentRead = () => (scheduled ? Math.min(0.95, (r.max || 0) / scheduled) : null);
  // Dernière ligne atteinte : la réunion s'arrête souvent avant la fin du créneau, la barre se complète
  const showProgress = () => report({ state: 'progress', label: 'Lecture de la transcription…', detail: `${fmt(r.max || 0)} · ${entries.size} répliques`, percent: r.endHere ? 1 : percentRead() });
  grabPhotos(r);
  showProgress();
  // Teams charge parfois les répliques par morceaux, surtout à la première ouverture d'une
  // transcription : quand rien ne bouge, on attend de plus en plus longtemps, en visant tour à
  // tour la dernière réplique lue et le bas de la liste. On ne s'arrête qu'à la vraie fin
  // (« transcription arrêtée ») ou après tous ces essais, et dans ce cas le widget prévient.
  const WAITS = [1.2, 1.8, 2.6, 3.6];
  let incomplete = false, still = 0, stuck = 0, resets = 0, lastMax = r.max;
  const giveUp = (why) => { log(`arrêt avant la fin : ${why}`); incomplete = true; };
  for (let k = 0; k < maxPasses && r.lastIdx >= 0; k++) {
    // Dernière ligne = « transcription arrêtée » : une vérification suffit, au cas où la
    // transcription aurait été relancée
    const atEnd = r.endHere;
    const target = still % 2 === 1 && r.slots > 0 ? r.slots - 1 : r.lastIdx;
    const fresh = scrollTo(target, r.labelsJSON, atEnd ? 2 : WAITS[Math.min(still, WAITS.length - 1)]);
    if (!fresh) {
      if (atEnd) break;
      if (++still >= WAITS.length) { giveUp('Teams ne charge plus rien'); break; }
      continue;
    }
    let n = readVisible(fresh);
    // Juste après un défilement vers l'avant, Teams peut n'afficher un instant que le début de
    // la réunion : on lui laisse d'abord une demi-seconde pour revenir.
    const backward = () => n.lastIdx >= 0 && n.max < cursor && n.max < r.max;
    for (let w = 0; w < 3 && backward(); w++) {
      delay(0.15);
      const again = readVisible();
      if (again.lastIdx >= 0) n = again;
    }
    // Sinon, c'est Teams qui a ramené la liste en haut : il le fait quand il reçoit la suite
    // d'une transcription qui vient d'être ouverte. On le laisse finir de charger avant de
    // repartir vers l'avant, au lieu de le relancer pendant le chargement, ce qui le ferait
    // revenir au début encore et encore.
    if (backward()) {
      resets++;
      log(`  Teams est revenu en haut (${fmt(n.max)} < ${fmt(cursor)}), attente de la fin du chargement`);
      report({ state: 'progress', label: 'Teams charge la suite…', detail: `${fmt(cursor)} · ${entries.size} répliques`, percent: percentRead() });
      settle(0.6, 2.5);
      let again = readVisible();
      if (again.lastIdx >= 0) n = again;
      // Teams s'est remis à suivre le début : on refait le geste pour qu'il arrête
      const moved = humanScroll(n.firstIdx, n.labelsJSON);
      if (moved) { again = readVisible(moved); if (again.lastIdx >= 0) n = again; }
      if (resets > 15) { giveUp('Teams revient sans cesse au début'); break; }
    }
    // Des répliques sont affichées sans leur texte : on leur laisse le temps d'arriver
    for (let w = 0; w < 8 && n.pending > 0; w++) {
      delay(0.25);
      const again = readVisible();
      if (again.lastIdx >= 0) n = again;
    }
    if (n.lastIdx < 0) {
      if (++still >= WAITS.length) { giveUp('lecture impossible'); break; }
      continue;
    }
    // Continuité stricte : la dernière ligne lue doit encore être là, sinon on a sauté des
    // répliques. On revient en arrière jusqu'à la retrouver. Si remonter vers le début de la
    // fenêtre ne fait rien bouger (ligne déjà à l'écran), on vise la ligne juste au-dessus.
    for (let k2 = 0; k2 < 8 && n.times && n.times.indexOf(cursor) < 0 && n.max > cursor; k2++) {
      jumps++;
      log(`recul : ${fmt(cursor)} absent de la lecture (${fmt(n.windowStart)}-${fmt(n.max)})`);
      let back = scrollTo(n.windowIdx, n.labelsJSON, 1.2);
      if (!back && n.windowIdx > 0) back = scrollTo(n.windowIdx - 1, n.labelsJSON, 1.6);
      if (!back) break;
      const b = readVisible(back);
      if (b.lastIdx < 0) break;
      n = b;
    }
    if (n.times && n.times.indexOf(cursor) < 0 && n.max > cursor) { holes++; log(`trou après ${fmt(cursor)}`); }
    r = n;
    still = 0;
    if (n.max <= cursor) {
      // Teams a ramené la liste en arrière : on repart vers l'avant. Ce n'est un blocage que si
      // la lecture ne progresse plus du tout d'une passe à l'autre.
      if (atEnd) break;
      stuck = n.max > lastMax ? 0 : stuck + 1;
      lastMax = n.max;
      if (stuck >= 6) { giveUp('la liste ne progresse plus'); break; }
      continue;
    }
    grabPhotos(n);
    showProgress();
    cursor = n.max;
    lastMax = n.max;
    stuck = 0;
  }
  // Sans la ligne de fin, on ne peut pas être sûr d'avoir tout lu
  if (!incomplete && !r.endHere && ![...entries.values()].some((e) => END_RE.test(e.text) && e.time >= cursor)) {
    log('fin de transcription non vue');
    incomplete = true;
  }

  // ---------- Résultat ----------
  const rows = [...entries.values()].sort((a, b) => a.time - b.time || a.seq - b.seq);
  const lines = rows.map((r) => `[${fmt(r.time)}] ${r.speaker ? r.speaker + ' : ' : ''}${r.text}`);
  const text = lines.join('\n');
  app.setTheClipboardTo(text);

  if (debug) {
    const peek = (l) => l.slice(0, 60);
    return `${incomplete ? 'INCOMPLET ? ' : ''}${resets ? resets + ' retours de Teams au début, ' : ''}${lines.length} répliques en ${((Date.now() - tStart) / 1000).toFixed(1)} s au total (${((Date.now() - t0) / 1000).toFixed(1)} s de défilement), ${retries} relectures, ${jumps} reculs, ${holes} trous\n` + lines.slice(0, 3).map(peek).join('\n') + '\n...\n' + lines.slice(-3).map(peek).join('\n');
  }

  // Le widget passe en carte finale ; il reçoit la transcription par un fichier
  const data = { title: meetingTitle, date: meetingDate, rows: rows.map((r) => ({ time: fmt(r.time), speaker: r.speaker, text: r.text })), text, holes, incomplete, photos };
  writeFile('derniere-transcription.json', JSON.stringify(data));
  writeFile('photos.json', JSON.stringify(photos));
  journal.push(`fin : ${lines.length} répliques, ${resets} retours de Teams au début, ${jumps} reculs, ${holes} trous${incomplete ? ', peut-être incomplet' : ''}`);
  writeFile('journal.txt', journal.join('\n'));
  // Laisser voir la barre pleine avant que la fenêtre ne s'agrandisse
  report({ state: 'progress', label: 'Terminé', detail: `${lines.length} répliques copiées`, percent: 1 });
  delay(0.4);
  report({ state: 'done' });
  return `${lines.length} répliques copiées`;
}
