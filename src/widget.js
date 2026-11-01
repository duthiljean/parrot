// Fenêtre de Parrot, style macOS, en une seule pièce :
//  1. dès le lancement, petite pastille avec le perroquet animé et la progression ;
//  2. à la fin, elle s'agrandit en carte : résumé, nettoyage du texte, collage dans Claude ou
//     ChatGPT, export Word/PDF/TXT.
// Utilisé par l'app « Parrot Widget », qui reste ouverte : macOS gère alors la fenêtre
// nativement (défilement fluide). Elle n'a besoin d'aucune autorisation Accessibilité.
//
// Dialogue avec le programme de copie, par fichiers dans le dossier de données :
//   etat.json                  { state: 'start' | 'progress' | 'done' | 'error', ... }
//   derniere-transcription.json { title, rows, text, holes }
//   action.json                { target } : demande à Parrot de coller le texte (voir le programme)

const TT_DIR = () => $.NSHomeDirectory().js + '/Library/Application Support/Transcription Teams/';
const TT_APPS = { claude: 'Claude', chatgpt: 'ChatGPT' };
const TT_SIZES = { hud: [320, 84], error: [320, 150], card: [348, 600] };

// Perroquet de la pastille : le fond reste fixe, le CSS anime seulement l'oiseau
const TT_PARROT = `<svg class="parrot" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <clipPath id="p-clip"><rect x="100" y="100" width="824" height="824" rx="186"/></clipPath>
    <clipPath id="p-body"><path d="M306 806C300 704 268 604 286 504C302 344 402 256 522 256C622 256 684 316 694 396L694 472C694 522 652 552 628 578C612 596 606 620 600 650C584 730 516 796 432 836C388 856 334 848 306 806Z"/></clipPath>
    <clipPath id="p-side"><path d="M328 522C418 502 500 542 500 622C500 702 440 772 360 804C338 722 318 622 328 522Z"/></clipPath>
    <clipPath id="p-beak"><path d="M608 274C690 256 806 340 812 462C815 514 796 558 762 582C772 540 752 506 700 490C672 482 650 480 628 484C652 430 654 360 608 274Z"/></clipPath>
    <clipPath id="p-jaw"><path d="M640 478C680 476 718 494 720 540C722 566 692 588 660 588C644 588 632 578 624 560Z"/></clipPath>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="186" fill="#E10014"/>
  <g clip-path="url(#p-clip)">
    <g fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="10" stroke-linecap="round"><path d="M700 90L960 350M770 90L960 280M640 90L960 410"/><path d="M60 640L400 980M60 720L320 980M60 560L480 980"/></g>
    <g class="p-wind"><path d="M640 250h120"/><path d="M720 700h150"/><path d="M600 830h100"/></g>
    <g transform="translate(52 62) scale(.87) translate(90 0) skewX(-8)">
      <g class="p-bird">
        <g class="p-far"><path d="M328 522C418 502 500 542 500 622C500 702 440 772 360 804C338 722 318 622 328 522Z" fill="#5A0612"/></g>
        <g class="p-tail">
          <path d="M300 720C250 734 206 754 168 780C204 832 270 838 330 800Z" fill="#fff"/>
          <path d="M312 760L222 846C262 870 318 862 356 826Z" fill="#FFCC00"/>
          <path d="M322 790L268 898C330 900 398 872 436 824Z" fill="#8E0018"/>
        </g>
        <g class="p-crest">
          <path d="M404 312C352 246 306 216 244 222C268 268 322 316 376 346Z" fill="#FFCC00"/>
          <path d="M446 282C414 214 372 176 312 168C328 222 372 274 416 304Z" fill="#fff"/>
          <path d="M496 262C486 202 456 156 406 134C406 192 436 248 468 274Z" fill="#8E0018"/>
        </g>
        <path d="M306 806C300 704 268 604 286 504C302 344 402 256 522 256C622 256 684 316 694 396L694 472C694 522 652 552 628 578C612 596 606 620 600 650C584 730 516 796 432 836C388 856 334 848 306 806Z" fill="#FF9F0A"/>
        <g clip-path="url(#p-body)"><path d="M306 806C300 704 268 604 286 504C302 344 402 256 522 256C622 256 684 316 694 396L694 472C694 522 652 552 628 578C612 596 606 620 600 650C584 730 516 796 432 836C388 856 334 848 306 806Z" transform="translate(26 -12)" fill="#FFCC00"/></g>
        <g fill="none" stroke="#FF9F0A" stroke-width="10" stroke-linecap="round"><path d="M531 598q22 26 44 0"/><path d="M523 656q22 26 44 0" transform="rotate(6 545 656)"/><path d="M502 714q22 26 44 0" transform="rotate(14 524 714)"/></g>
        <ellipse cx="530" cy="388" rx="84" ry="86" fill="#fff"/>
        <circle cx="554" cy="380" r="46" fill="#1E73E8"/><circle cx="554" cy="380" r="33" fill="#5A0612"/><circle cx="567" cy="367" r="11" fill="#fff"/>
        <path d="M640 478C680 476 718 494 720 540C722 566 692 588 660 588C644 588 632 578 624 560Z" fill="#FFF4D6"/>
        <g clip-path="url(#p-jaw)"><path d="M718 522C716 556 690 574 660 574C644 574 632 566 620 554L620 600L730 600L730 522Z" fill="#F2B84B"/></g>
        <path d="M608 274C690 256 806 340 812 462C815 514 796 558 762 582C772 540 752 506 700 490C672 482 650 480 628 484C652 430 654 360 608 274Z" fill="#F2B84B" stroke="#E10014" stroke-width="18" stroke-linejoin="miter" stroke-miterlimit="6" paint-order="stroke"/>
        <g clip-path="url(#p-beak)"><path d="M608 274C690 256 806 340 812 462C815 514 796 558 762 582C772 540 752 506 700 490C672 482 650 480 628 484C652 430 654 360 608 274Z" transform="translate(-14 -6)" fill="#FFF4D6"/></g>
        <g class="p-wing">
          <path d="M328 522C418 502 500 542 500 622C500 702 440 772 360 804C338 722 318 622 328 522Z" fill="#7A0016"/>
          <g clip-path="url(#p-side)">
            <path d="M320 590C372 572 430 580 510 610L510 640Q474 668 432 640Q416 688 380 652Q360 696 320 656Z" fill="#A8001A"/>
            <path d="M320 510L510 510L510 612C430 580 372 572 320 590Z" fill="#E10014"/>
            <g fill="none" stroke="#A8001A" stroke-width="10" stroke-linecap="round"><path d="M380 658C384 704 380 752 366 802"/><path d="M432 646C436 692 430 736 404 780"/></g>
          </g>
        </g>
      </g>
    </g>
  </g>
</svg>
`;

function ttRead(name) {
  const s = $.NSString.stringWithContentsOfFileEncodingError($(TT_DIR() + name), $.NSUTF8StringEncoding, null);
  return s.isNil() ? null : s.js;
}
function ttWrite(name, text) {
  return $(text).writeToFileAtomicallyEncodingError($(TT_DIR() + name), true, $.NSUTF8StringEncoding, null);
}
function ttFileURI(path) {
  const d = $.NSData.dataWithContentsOfFile($(path));
  return d.isNil() ? '' : 'data:image/png;base64,' + d.base64EncodedStringWithOptions(0).js;
}

// Icône d'une app installée, en PNG (data URI), ou '' si l'app est absente
function ttAppIcon(appName, size) {
  try {
    const ws = $.NSWorkspace.sharedWorkspace;
    const path = ws.fullPathForApplication($(appName));
    if (!path || path.isNil()) return '';
    const icon = ws.iconForFile(path);
    const out = $.NSImage.alloc.initWithSize($.NSMakeSize(size, size));
    out.lockFocus;
    icon.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, size, size), $.NSMakeRect(0, 0, 0, 0), $.NSCompositingOperationSourceOver, 1);
    const rep = $.NSBitmapImageRep.alloc.initWithFocusedViewRect($.NSMakeRect(0, 0, size, size));
    out.unlockFocus;
    const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary);
    return 'data:image/png;base64,' + png.base64EncodedStringWithOptions(0).js;
  } catch (e) { return ''; }
}

function ttPrefs() {
  const p = { fillers: true, merge: true, times: false, assistant: 'chatgpt' };
  try {
    const saved = JSON.parse(ttRead('preference.json') || '{}');
    for (const k of ['fillers', 'merge', 'times']) if (typeof saved[k] === 'boolean') p[k] = saved[k];
    if (Object.prototype.hasOwnProperty.call(TT_APPS, saved.assistant)) p.assistant = saved.assistant;
  } catch (e) {}
  return p;
}

// ---------- Code de la page (exécuté dans la vue web) ----------
function ttClient() {
  const el = (id) => document.getElementById(id);
  const post = (m) => window.webkit.messageHandlers.tt.postMessage(m);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const countWords = (t) => t.split(/\s+/).filter(Boolean).length;
  let data = null, prefs = null, shown = '', gone = false, shownPercent = 0;

  // ----- Nettoyage du texte -----
  const FILLER = /(^|[\s,;:.!?…«"'(—–-])(?:euh+|heu+|hum+|hmm+|mmh+|mh+|uh+|um+)(?=$|[\s,;:.!?…»"')—–-])[,;…]*/giu;
  function stripFillers(text) {
    let s = text, before;
    do { before = s; s = s.replace(FILLER, '$1'); } while (s !== before);
    s = s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').replace(/([,;])\1+/g, '$1').replace(/,\s*([.!?…])/g, '$1')
      .replace(/^[\s,;:.…—–-]+/, '').trim();
    return s && s !== text.trim() ? s[0].toLocaleUpperCase('fr') + s.slice(1) : s;
  }
  function cleanedRows() {
    let rows = data.rows.map((r) => ({ time: r.time, speaker: r.speaker, text: r.text }));
    if (prefs.fillers) rows = rows.map((r) => ({ ...r, text: stripFillers(r.text) })).filter((r) => /[\p{L}\p{N}]/u.test(r.text));
    if (prefs.merge) {
      const merged = [];
      for (const r of rows) {
        const last = merged[merged.length - 1];
        if (last && last.speaker === r.speaker) last.text += ' ' + r.text; else merged.push({ ...r });
      }
      rows = merged;
    }
    return rows;
  }
  const lineOf = (r) => `${prefs.times ? '' : `[${r.time}] `}${r.speaker ? r.speaker + ' : ' : ''}${r.text}`;
  const textOf = (rows) => rows.map(lineOf).join('\n');

  // ----- Carte finale -----
  const speakers = () => [...new Set(data.rows.map((r) => r.speaker).filter(Boolean))];
  const tone = (sp) => 'c' + Math.max(0, speakers().indexOf(sp) % 5);
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // Photo de l'intervenant si Parrot a pu la récupérer, sinon ses initiales
  const avatar = (sp, cls) => {
    const photo = data.photos && data.photos[sp];
    return photo
      ? `<span class="av ph ${cls}" title="${esc(sp)}"><img src="${photo}" alt=""></span>`
      : `<span class="av ${cls} ${tone(sp)}" title="${esc(sp)}">${esc(initials(sp || 'T'))}</span>`;
  };

  function render(animateNumbers) {
    const rows = cleanedRows();
    shown = textOf(rows);
    el('well').innerHTML = rows.map((r) => `<section class="msg">
      <header>${avatar(r.speaker, 'sm')}<b>${esc(r.speaker || 'Teams')}</b>${prefs.times ? '' : `<time>${esc(r.time)}</time>`}</header>
      <p>${esc(r.text)}</p></section>`).join('');
    const words = countWords(shown), raw = countWords(data.text);
    const saved = raw - words;
    el('saved').textContent = saved > 0 ? `${num(saved)} mots en moins` : '';
    setStat('sWords', words, '', animateNumbers);
    setStat('sLines', rows.length, '', animateNumbers);
    for (const k of ['fillers', 'merge', 'times']) el('o-' + k).classList.toggle('on', prefs[k]);
    edges();
  }
  function setStat(id, end, unit, animate) {
    const node = el(id);
    if (!animate || reduce) { node.textContent = num(end) + unit; return; }
    const t0 = performance.now() + 120, dur = 600;
    const step = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
      node.textContent = num(Math.round(end * e)) + unit;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { node.textContent = num(end) + unit; }, 1200); // au cas où l'animation ne tourne pas
  }
  function edges() {
    const w = el('well');
    w.style.setProperty('--ft', w.scrollTop > 2 ? '24px' : '0px');
    w.style.setProperty('--fb', w.scrollTop + w.clientHeight < w.scrollHeight - 2 ? '24px' : '0px');
  }
  function toggle(key) {
    prefs[key] = !prefs[key];
    render(false);
    post({ a: 'copy', text: shown });
    post({ a: 'prefs', prefs });
  }
  function toast(message) {
    const t = el('toast');
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function exportDoc(format) {
    const rows = cleanedRows();
    const people = speakers().join(', ');
    const title = data.title || 'Réunion Teams';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>
      <h1>${esc(title)}</h1><p><b>Date :</b> ${esc(data.date || new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' }))}<br><b>Participants :</b> ${esc(people)}<br><b>Durée :</b> ${esc(el('sTime').textContent)}</p><hr>
      ${rows.map((r) => `<p><b>${esc(r.speaker || '')}</b>${prefs.times ? '' : ` <font color="#888888">${esc(r.time)}</font>`}<br>${esc(r.text)}</p>`).join('\n')}
      </body></html>`;
    post({ a: 'export', format, name: title, text: shown, html });
  }
  function leave(message) {
    if (gone) return;
    gone = true;
    document.body.classList.add('out');
    setTimeout(() => post(message), reduce ? 0 : 160);
  }
  function send(target) {
    prefs.assistant = target;
    leave({ a: 'send', target, text: shown, prefs });
  }

  // ----- Appelé par l'app -----
  window.tt = {
    progress(s) {
      el('hudT').textContent = s.label || 'Parrot démarre…';
      el('hudS').textContent = s.detail || '';
      const bar = el('bar');
      if (typeof s.percent === 'number') {
        shownPercent = Math.max(shownPercent, s.percent);
        bar.classList.remove('wait');
        el('fill').style.width = Math.round(shownPercent * 100) + '%';
      } else bar.classList.add('wait');
    },
    error(message) {
      el('hud').classList.add('hidden');
      el('err').classList.remove('hidden');
      el('errT').textContent = message;
    },
    done(d, p) {
      data = d; prefs = p;
      el('title').textContent = d.title || 'Réunion Teams';
      const last = d.rows.length ? d.rows[d.rows.length - 1].time : '0:00';
      const minutes = Math.max(1, Math.round(last.split(':').reduce((a, n) => a * 60 + +n, 0) / 60));
      el('sTime').textContent = minutes + ' min';
      const sp = speakers();
      const shownPeople = sp.slice(0, 4).map((s) => avatar(s, '')).join('');
      const first = sp.map((s) => s.split(/\s+/)[0]);
      el('stack').innerHTML = shownPeople;
      el('names').textContent = first.length <= 2 ? first.join(' et ') : `${first.slice(0, 2).join(', ')} et ${first.length - 2} autre${first.length > 3 ? 's' : ''}`;
      el('warn').classList.toggle('hidden', !d.holes);
      document.querySelectorAll('.tile').forEach((b) => b.classList.toggle('pref', b.dataset.go === prefs.assistant));
      el('hud').classList.add('hidden');
      el('card').classList.remove('hidden');
      render(true);
      post({ a: 'copy', text: shown });
    },
    exported(message) { toast(message); },
  };

  // ----- Actions -----
  document.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.opt)));
  document.querySelectorAll('.tile').forEach((b) => b.addEventListener('click', () => send(b.dataset.go)));
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => exportDoc(b.dataset.export)));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => leave({ a: 'close' })));
  el('well').addEventListener('scroll', edges, { passive: true });
  const menu = (open) => {
    el('pop').classList.toggle('open', open);
    el('gear').setAttribute('aria-expanded', String(open));
  };
  const menuOpen = () => el('pop').classList.contains('open');
  el('gear').addEventListener('click', (e) => { e.stopPropagation(); menu(!menuOpen()); });
  el('pop').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => menu(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (menuOpen()) menu(false); else leave({ a: 'close' }); return; }
    if (!data) return;
    if (e.key === 'Enter') send(prefs.assistant);
    if (e.key === '1') send('claude');
    if (e.key === '2') send('chatgpt');
  });
}

function ttHTML(a) {
  const tile = (key, n) => {
    const name = TT_APPS[key];
    const icon = a.icons[key] ? `<img src="${a.icons[key]}" alt="">` : `<span class="glyph">${name[0]}</span>`;
    return `<button class="tile" data-go="${key}">${icon}<span class="lbl">${name}</span><kbd>${n}</kbd></button>`;
  };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{
    color-scheme:light dark;
    --ink:#1d1d1f;--muted:rgba(60,60,67,.62);--faint:rgba(60,60,67,.36);
    --fill:rgba(120,120,128,.12);--fill-hover:rgba(120,120,128,.2);--well:rgba(255,255,255,.55);
    --hair:rgba(0,0,0,.08);--edge:rgba(0,0,0,.1);--accent:#007aff;--pop:#f7f7f9;
    --r-card:16px;--r-in:12px;--r-tile:11px;
    --ease:cubic-bezier(.2,.9,.25,1);--spring:cubic-bezier(.34,1.56,.64,1);
  }
  @media (prefers-color-scheme: dark){:root{
    --ink:#f5f5f7;--muted:rgba(235,235,245,.6);--faint:rgba(235,235,245,.32);
    --fill:rgba(118,118,128,.24);--fill-hover:rgba(118,118,128,.34);--well:rgba(0,0,0,.18);
    --hair:rgba(255,255,255,.07);--edge:rgba(255,255,255,.14);--accent:#0a84ff;--pop:#2c2c30;
  }}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:transparent;-webkit-user-select:none;cursor:default;overflow:hidden}
  body{color:var(--ink);font:13px/1.38 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;border-radius:var(--r-card);
    box-shadow:inset 0 0 0 .5px var(--edge);-webkit-font-smoothing:antialiased;transition:opacity .16s ease,transform .18s var(--ease)}
  body.out{opacity:0;transform:scale(.97)}
  .hidden{display:none!important}
  button{font-family:inherit;border:0;cursor:default}

  /* Pastille de progression */
  #hud{height:100%;display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;padding:0 14px}
  #hud svg{width:56px;height:56px;display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,.18))}
  .p-bird{transform-origin:512px 512px}
  .p-wing,.p-far{transform-origin:398px 528px}
  .p-tail{transform-origin:330px 790px}
  .p-crest{transform-origin:440px 300px}
  .p-wind path{stroke:#fff;stroke-width:16;stroke-linecap:round;opacity:0}
  #hudT{font-size:13px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #hudS{font-size:11px;color:var(--muted);min-height:15px;font-variant-numeric:tabular-nums;white-space:nowrap}
  .bar{height:5px;border-radius:3px;background:var(--fill-hover);overflow:hidden;margin-top:6px;position:relative}
  #fill{display:block;height:100%;width:0;border-radius:3px;background:var(--accent);transition:width .35s var(--ease)}
  .bar.wait #fill{width:34%;position:absolute}

  /* Message d'erreur */
  #err{height:100%;display:grid;grid-template-columns:44px 1fr;gap:12px;padding:16px}
  #err img{width:44px;height:44px}
  #errT{font-size:12px;line-height:1.4;max-height:86px;overflow:hidden}
  #err button{grid-column:2;justify-self:end;align-self:end;height:26px;padding:0 14px;border-radius:7px;background:var(--fill-hover);color:var(--ink);font-size:12px;font-weight:500}

  /* Carte finale */
  #card{position:relative;height:100%;display:flex;flex-direction:column;padding:16px}
  .head{display:grid;grid-template-columns:38px 1fr 22px 22px;gap:6px;align-items:center}
  .head>:nth-child(2){margin-left:4px}
  #gear[aria-expanded="true"]{background:var(--fill);color:var(--ink)}
  #gear svg{width:13px;height:13px}
  .logo{position:relative;width:38px;height:38px}
  .logo img{width:38px;height:38px;display:block}
  .badge{position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;background:#34c759;display:grid;place-items:center;box-shadow:0 0 0 1.5px var(--ring,#fff)}
  @media (prefers-color-scheme: dark){:root{--ring:#2a2a2e}}
  .badge svg{width:9px;height:9px}
  h1{font-size:13px;font-weight:600;letter-spacing:-.01em}
  .sub{font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .x{width:22px;height:22px;border-radius:50%;background:transparent;color:var(--faint);display:grid;place-items:center;transition:background .15s,color .15s}
  .x:hover{background:var(--fill);color:var(--muted)} .x svg{width:10px;height:10px}

  .stats{display:grid;grid-template-columns:repeat(3,1fr);margin-top:12px;background:var(--fill);border-radius:var(--r-in);padding:8px 0}
  .stat{text-align:center;position:relative}
  .stat+.stat::before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:.5px;background:var(--hair)}
  .stat b{display:block;font-size:16px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .stat span{font-size:10.5px;color:var(--muted)}

  .people{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11.5px;color:var(--muted)}
  .stack{display:flex}.stack .av+.av{margin-left:-4px}
  .av{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:8.5px;font-weight:700;color:#fff;letter-spacing:.02em;box-shadow:0 0 0 1.5px var(--ring,#fff)}
  .av.sm{width:18px;height:18px;font-size:7px;box-shadow:none}
  .av.ph{overflow:hidden;background:var(--fill)}
  .av.ph img{width:100%;height:100%;object-fit:cover;transform:scale(1.1);display:block}
  .c0{background:#0a84ff}.c1{background:#ff9f0a}.c2{background:#bf5af2}.c3{background:#30b0c7}.c4{background:#ff375f}
  .warn{margin-top:8px;font-size:11px;color:#ff9f0a}

  #pop{position:absolute;top:50px;right:14px;z-index:5;width:196px;padding:5px;border-radius:12px;background:var(--pop);box-shadow:0 8px 24px rgba(0,0,0,.2),0 0 0 .5px var(--edge);
    opacity:0;visibility:hidden;transform:translateY(-4px) scale(.98);transform-origin:top right;transition:opacity .14s,transform .16s var(--ease),visibility .16s}
  #pop.open{opacity:1;visibility:visible;transform:none}
  .opt{width:100%;height:28px;padding:0 8px;border-radius:7px;background:transparent;color:var(--ink);font-size:12px;font-weight:500;display:flex;align-items:center;gap:8px;transition:background .15s,transform .18s var(--ease)}
  .opt i{width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--faint);display:grid;place-items:center;transition:background .18s,box-shadow .18s}
  .opt i svg{width:8px;height:8px;opacity:0;transition:opacity .15s}
  .opt.on i{background:var(--accent);box-shadow:none}.opt.on i svg{opacity:1}
  .opt:hover{background:var(--fill)}.opt:active{transform:scale(.98)}
  #saved{padding:4px 8px 3px;font-size:10.5px;color:var(--muted)}
  #saved:empty{display:none}

  .well{flex:1;min-height:0;margin-top:10px;overflow:auto;background:var(--well);border-radius:var(--r-in);box-shadow:inset 0 0 0 .5px var(--hair);padding:2px 12px;-webkit-user-select:text;cursor:text;
    --ft:0px;--fb:24px;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 var(--ft),#000 calc(100% - var(--fb)),transparent 100%)}
  .well::-webkit-scrollbar{width:6px}.well::-webkit-scrollbar-thumb{background:var(--fill-hover);border-radius:3px}
  .msg{padding:8px 0}.msg+.msg{border-top:.5px solid var(--hair)}
  .msg header{display:flex;align-items:center;gap:6px;margin-bottom:3px;font-size:11.5px}
  .msg b{font-weight:600}
  time{margin-left:auto;font:10.5px ui-monospace,SFMono-Regular,monospace;color:var(--faint)}
  .msg p{font-size:12px;line-height:1.45;padding-left:22px}

  .send{margin-top:10px}
  .send small{display:block;font-size:10.5px;font-weight:500;color:var(--muted);margin:0 2px 6px}
  .tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .tile{position:relative;height:46px;border-radius:var(--r-tile);background:var(--fill);color:var(--ink);display:flex;align-items:center;gap:9px;padding:0 12px;
    font-size:13px;font-weight:600;transition:transform .2s var(--ease),background .2s,box-shadow .2s}
  .tile img,.tile .glyph{width:26px;height:26px;border-radius:7px;flex:none}
  .tile .glyph{display:grid;place-items:center;background:var(--fill-hover)}
  .tile kbd{margin-left:auto;font:500 10.5px -apple-system,sans-serif;color:var(--faint);border:.5px solid var(--edge);border-radius:4px;padding:0 5px;line-height:16px}
  .tile:hover{background:var(--fill-hover);transform:translateY(-1px)}
  .tile:active{transform:scale(.97);transition-duration:.08s}
  .tile.pref{background:var(--accent);color:#fff;box-shadow:0 3px 10px rgba(0,122,255,.3)}
  .tile.pref:hover{background:var(--accent);filter:brightness(1.06)}
  .tile.pref kbd{color:rgba(255,255,255,.8);border-color:rgba(255,255,255,.35)}
  button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

  .exports{display:flex;align-items:center;gap:6px;margin-top:10px;position:relative}
  .exports span.l{font-size:10.5px;font-weight:500;color:var(--muted);margin-right:2px}
  .exp{height:24px;padding:0 10px;border-radius:7px;background:var(--fill);color:var(--ink);font-size:11px;font-weight:500;transition:background .15s,transform .18s var(--ease)}
  .exp:hover{background:var(--fill-hover)}.exp:active{transform:scale(.96)}
  #toast{margin-left:auto;font-size:10.5px;color:var(--muted);opacity:0;transform:translateY(3px);transition:opacity .2s,transform .2s var(--ease);max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #toast.show{opacity:1;transform:none}

  @media (prefers-reduced-motion: no-preference){
    /* Le fond de l'icône reste fixe : seul le perroquet vole */
    .p-bird{animation:p-hover .6s ease-in-out infinite}
    @keyframes p-hover{0%,100%{transform:translateY(30px) rotate(-8deg)}45%{transform:translateY(-34px) rotate(-8deg)}}
    .p-wing{animation:p-flap .6s infinite}
    .p-far{animation:p-flap-far .6s infinite}
    @keyframes p-flap{0%,100%{transform:rotate(152deg) scale(1.22,1.3);animation-timing-function:cubic-bezier(.55,0,.75,.6)}45%{transform:rotate(8deg) scale(1,1);animation-timing-function:cubic-bezier(.25,.4,.45,1)}}
    @keyframes p-flap-far{0%,100%{transform:rotate(174deg) scale(1.16,1.24);animation-timing-function:cubic-bezier(.55,0,.75,.6)}45%{transform:rotate(30deg) scale(1,1);animation-timing-function:cubic-bezier(.25,.4,.45,1)}}
    .p-tail{animation:p-tail .6s ease-in-out infinite}
    @keyframes p-tail{0%,100%{transform:rotate(-7deg)}45%{transform:rotate(7deg)}}
    .p-crest{animation:p-crest .6s ease-in-out infinite}
    @keyframes p-crest{0%,100%{transform:rotate(-5deg)}45%{transform:rotate(5deg)}}
    .p-wind path{animation:p-wind 1s linear infinite}
    .p-wind path:nth-child(2){animation-delay:-.35s}.p-wind path:nth-child(3){animation-delay:-.7s}
    @keyframes p-wind{0%{transform:translateX(330px);opacity:0}20%{opacity:.55}80%{opacity:.55}100%{transform:translateX(-430px);opacity:0}}
    .bar.wait #fill{animation:slide 1.2s ease-in-out infinite}
    @keyframes slide{0%{left:-34%}100%{left:100%}}
    #card>*{animation:rise .42s var(--ease) backwards}
    #card>:nth-child(2){animation-delay:45ms}#card>:nth-child(3){animation-delay:90ms}#card>:nth-child(4){animation-delay:135ms}
    #card>:nth-child(5){animation-delay:180ms}#card>:nth-child(6){animation-delay:225ms}#card>:nth-child(7){animation-delay:270ms}
    #card>:nth-child(n+8){animation-delay:315ms}
    @keyframes rise{from{opacity:0;transform:translateY(8px)}}
    .badge{animation:pop .5s var(--spring) backwards .25s}
    @keyframes pop{from{transform:scale(0)}}
    .badge path{stroke-dasharray:22;stroke-dashoffset:22;animation:draw .3s cubic-bezier(.65,0,.35,1) forwards .45s}
    @keyframes draw{to{stroke-dashoffset:0}}
  }
  </style></head><body>
  <div id="hud">
    ${TT_PARROT}
    <div style="min-width:0"><div id="hudT">Parrot démarre…</div><div id="hudS"></div><div class="bar wait" id="bar"><span id="fill"></span></div></div>
  </div>
  <div id="err" class="hidden">
    <img src="${a.logo}" alt=""><div id="errT"></div><button data-close>Fermer</button>
  </div>
  <div id="card" class="hidden">
    <div class="head">
      <div class="logo"><img src="${a.logo}" alt=""><div class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4 4 9-9.5"/></svg></div></div>
      <div style="min-width:0"><h1>Transcription copiée</h1><div class="sub" id="title"></div></div>
      <button class="x" id="gear" title="Nettoyage du texte" aria-expanded="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4.5h7M13 4.5h1M2 11.5h1M7 11.5h7"/><circle cx="11" cy="4.5" r="2"/><circle cx="5" cy="11.5" r="2"/></svg></button>
      <button class="x" data-close title="Fermer (Échap)"><svg viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 2l6 6M8 2L2 8"/></svg></button>
    </div>
    <div class="stats">
      <div class="stat"><b id="sTime"></b><span>durée</span></div>
      <div class="stat"><b id="sLines">0</b><span>répliques</span></div>
      <div class="stat"><b id="sWords">0</b><span>mots</span></div>
    </div>
    <div class="people"><div class="stack" id="stack"></div><span id="names"></span></div>
    <div class="warn hidden" id="warn">Il manque peut-être des passages. Relance si besoin.</div>
    <div class="well" id="well"></div>
    <div class="send">
      <small>Coller dans une nouvelle conversation</small>
      <div class="tiles">${tile('claude', 1)}${tile('chatgpt', 2)}</div>
    </div>
    <div class="exports">
      <span class="l">Exporter</span>
      <button class="exp" data-export="docx">Word</button><button class="exp" data-export="pdf">PDF</button><button class="exp" data-export="txt">TXT</button>
      <span id="toast"></span>
    </div>
    <div id="pop" role="menu">
      ${[['fillers', 'Sans « euh »'], ['merge', 'Fusionner les répliques'], ['times', 'Sans les heures']].map(([k, l]) => `<button class="opt" id="o-${k}" data-opt="${k}" role="menuitemcheckbox"><i><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5l4 4 9-9.5"/></svg></i>${l}</button>`).join('')}
      <div id="saved"></div>
    </div>
  </div>
  <script>(${ttClient.toString()})();</script>
  </body></html>`;
}

// ---------- Actions côté Mac ----------
function ttShell(cmd) {
  const sa = Application.currentApplication();
  sa.includeStandardAdditions = true;
  return sa.doShellScript(cmd);
}
const ttQuote = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

function ttCopy(text) {
  const pb = $.NSPasteboard.generalPasteboard;
  pb.clearContents;
  pb.setStringForType($(text), $.NSPasteboardTypeString);
}

// Enregistre dans Téléchargements (sans écraser) et renvoie le nom du fichier
function ttExport(m) {
  const safe = String(m.name).replace(/[\\/:*?"<>|\n\r]/g, '-').replace(/^\.+/, '').trim().slice(0, 60) || 'Reunion';
  const day = new Date().toISOString().slice(0, 10);
  const downloads = $.NSHomeDirectory().js + '/Downloads/';
  const fm = $.NSFileManager.defaultManager;
  let name = `Transcription - ${safe} - ${day}.${m.format}`;
  for (let i = 2; fm.fileExistsAtPath($(downloads + name)); i++) name = `Transcription - ${safe} - ${day} (${i}).${m.format}`;
  const out = downloads + name;
  if (m.format === 'txt') {
    if (!$(m.text).writeToFileAtomicallyEncodingError($(out), true, $.NSUTF8StringEncoding, null)) throw new Error('écriture impossible');
  } else {
    const tmp = TT_DIR() + 'export-temporaire.html', rtf = TT_DIR() + 'export-temporaire.rtf';
    ttWrite('export-temporaire.html', m.html);
    try {
      if (m.format === 'docx') ttShell(`/usr/bin/textutil -convert docx -inputencoding UTF-8 -output ${ttQuote(out)} ${ttQuote(tmp)}`);
      else {
        ttShell(`/usr/bin/textutil -convert rtf -inputencoding UTF-8 -output ${ttQuote(rtf)} ${ttQuote(tmp)}`);
        ttPDF(rtf, out);
      }
    } finally { ttShell(`rm -f ${ttQuote(tmp)} ${ttQuote(rtf)}`); }
    if (!fm.fileExistsAtPath($(out))) throw new Error('fichier non créé');
  }
  ttShell(`open -R ${ttQuote(out)}`);
  return name;
}

// PDF d'une seule page continue, avec le moteur d'impression de macOS (sans fenêtre). On passe
// par le RTF : importer du HTML ici bloquerait l'app, car cela attend le moteur web.
function ttPDF(rtfPath, out) {
  const data = $.NSData.dataWithContentsOfFile($(rtfPath));
  const text = $.NSAttributedString.alloc.initWithRTFDocumentAttributes(data, null);
  const view = $.NSTextView.alloc.initWithFrame($.NSMakeRect(0, 0, 595, 842));
  view.textContainerInset = $.NSMakeSize(56, 56);
  view.textStorage.setAttributedString(text);
  view.sizeToFit;
  const op = $.NSPrintOperation.PDFOperationWithViewInsideRectToPathPrintInfo(view, view.bounds, $(out), $.NSPrintInfo.sharedPrintInfo);
  op.showsPrintPanel = false;
  op.showsProgressPanel = false;
  if (!op.runOperation) throw new Error('PDF non créé');
}

// Le texte est dans le presse-papiers ; Parrot (qui a l'autorisation) le colle, sans l'envoyer, puis se referme
function ttSend(m) {
  ttCopy(m.text);
  ttWrite('preference.json', JSON.stringify(m.prefs));
  ttWrite('action.json', JSON.stringify({ target: m.target, at: Date.now() }));
  const parrot = (JSON.parse(ttRead('etat.json') || '{}').app) || '/Applications/Parrot.app';
  ttShell(`open -n ${ttQuote(parrot)}`);
}

// ---------- Fenêtre native : carte translucide sans barre de titre ----------
function showWidget() {
  ObjC.import('Cocoa');
  ObjC.import('WebKit');

  const W = () => globalThis.__ttWidget;
  const js = (code) => W().web.evaluateJavaScriptCompletionHandler($(code), () => {});
  const quit = () => $.NSApp.terminate(null);

  // La fenêtre grandit vers le bas : son coin haut droit reste en place
  function resize(kind) {
    const [w, h] = TT_SIZES[kind], f = W().win.frame;
    W().win.setFrameDisplayAnimate($.NSMakeRect(f.origin.x + f.size.width - w, f.origin.y + f.size.height - h, w, h), true, true);
    W().win.invalidateShadow;
  }

  function tick() {
    const raw = ttRead('etat.json');
    if (!raw || raw === W().last) return;
    W().last = raw;
    let s;
    try { s = JSON.parse(raw); } catch (e) { return; }
    if (s.state === 'done') {
      W().timer.invalidate;
      const data = ttRead('derniere-transcription.json');
      if (!data) { resize('error'); js(`tt.error(${JSON.stringify('La transcription est introuvable. Relance Parrot.')})`); return; }
      resize('card');
      js(`tt.done(${data}, ${JSON.stringify(ttPrefs())})`);
    } else if (s.state === 'error') {
      W().timer.invalidate;
      resize('error');
      js(`tt.error(${JSON.stringify(s.message || 'Une erreur est survenue.')})`);
    } else {
      js(`tt.progress(${raw})`);
    }
  }

  if (!$.TTWidgetHandler) {
    ObjC.registerSubclass({
      name: 'TTWidgetHandler',
      methods: {
        'userContentController:didReceiveScriptMessage:': {
          types: ['void', ['id', 'id']],
          implementation: function (ucc, msg) {
            const m = ObjC.deepUnwrap(msg.body);
            if (m.a === 'copy') ttCopy(m.text);
            else if (m.a === 'prefs') ttWrite('preference.json', JSON.stringify(m.prefs));
            else if (m.a === 'export') {
              try { ttExport(m); js(`tt.exported(${JSON.stringify('Enregistré dans Téléchargements')})`); }
              catch (e) { js(`tt.exported(${JSON.stringify('Export impossible')})`); }
            } else if (m.a === 'send') { try { ttSend(m); } catch (e) {} quit(); }
            else quit();
          },
        },
        'tick:': { types: ['void', ['id']], implementation: function () { tick(); } },
      },
    });
  }
  // Un panneau sans barre de titre ne prend pas le clavier par défaut : on l'autorise
  if (!$.TTPanel) {
    ObjC.registerSubclass({
      name: 'TTPanel',
      superclass: 'NSPanel',
      methods: { canBecomeKeyWindow: { types: ['bool', []], implementation: function () { return true; } } },
    });
  }

  const nsapp = $.NSApplication.sharedApplication;
  if (nsapp.activationPolicy == $.NSApplicationActivationPolicyProhibited) {
    nsapp.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  }

  const [w0, h0] = TT_SIZES.hud;
  // Panneau « non activant » : il passe devant sans attendre que macOS donne le premier plan à l'app
  const win = $.TTPanel.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(0, 0, w0, h0), $.NSWindowStyleMaskBorderless | $.NSWindowStyleMaskNonactivatingPanel, $.NSBackingStoreBuffered, false);
  win.releasedWhenClosed = false;
  win.hidesOnDeactivate = false;
  win.floatingPanel = true;
  win.level = $.NSStatusWindowLevel;
  // Visible sur le bureau en cours, y compris par-dessus une app en plein écran
  win.collectionBehavior = $.NSWindowCollectionBehaviorCanJoinAllSpaces | $.NSWindowCollectionBehaviorFullScreenAuxiliary;
  win.opaque = false;
  win.backgroundColor = $.NSColor.clearColor;
  win.hasShadow = true;

  const blur = $.NSVisualEffectView.alloc.initWithFrame($.NSMakeRect(0, 0, w0, h0));
  blur.material = $.NSVisualEffectMaterialPopover;
  blur.blendingMode = $.NSVisualEffectBlendingModeBehindWindow;
  blur.state = $.NSVisualEffectStateActive;
  blur.autoresizingMask = $.NSViewWidthSizable | $.NSViewHeightSizable;
  // Coins arrondis : le fond translucide ne se découpe qu'avec un masque (pas avec cornerRadius)
  const R = 16;
  const mask = $.NSImage.alloc.initWithSize($.NSMakeSize(2 * R + 1, 2 * R + 1));
  mask.lockFocus;
  $.NSColor.blackColor.set;
  $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius($.NSMakeRect(0, 0, 2 * R + 1, 2 * R + 1), R, R).fill;
  mask.unlockFocus;
  mask.capInsets = { top: R, left: R, bottom: R, right: R };
  mask.resizingMode = 1; // NSImageResizingModeStretch (la constante n'existe pas côté JavaScript)
  blur.maskImage = mask;

  const handler = $.TTWidgetHandler.alloc.init;
  const cfg = $.WKWebViewConfiguration.alloc.init;
  cfg.userContentController.addScriptMessageHandlerName(handler, $('tt'));
  const web = $.WKWebView.alloc.initWithFrameConfiguration($.NSMakeRect(0, 0, w0, h0), cfg);
  web.setValueForKey($.NSNumber.numberWithBool(false), $('drawsBackground'));
  web.autoresizingMask = $.NSViewWidthSizable | $.NSViewHeightSizable;
  blur.addSubview(web);
  win.contentView = blur;

  // Garder des références pour que la fenêtre reste en vie une fois la fonction terminée
  globalThis.__ttWidget = { win, web, handler, last: null, timer: null };

  web.loadHTMLStringBaseURL($(ttHTML({
    logo: ttFileURI(TT_DIR() + 'logo.png'),
    icons: { claude: ttAppIcon('Claude', 64), chatgpt: ttAppIcon('ChatGPT', 64) },
  })), $());

  // En haut à droite de l'écran où se trouve la souris, comme une notification
  let screen = $.NSScreen.mainScreen;
  const mouse = $.NSEvent.mouseLocation;
  const screens = $.NSScreen.screens;
  for (let i = 0; i < screens.count; i++) {
    const f = screens.objectAtIndex(i).frame;
    if (mouse.x >= f.origin.x && mouse.x < f.origin.x + f.size.width && mouse.y >= f.origin.y && mouse.y < f.origin.y + f.size.height) screen = screens.objectAtIndex(i);
  }
  const vf = screen.visibleFrame;
  const x = vf.origin.x + vf.size.width - w0 - 14, y = vf.origin.y + vf.size.height - h0 - 10;

  // Apparition : fondu + légère descente
  win.alphaValue = 0;
  win.setFrameOrigin($.NSMakePoint(x, y + 10));
  win.orderFrontRegardless;
  win.makeKeyWindow;
  win.makeFirstResponder(web);
  for (let k = 1; k <= 10; k++) {
    const p = 1 - Math.pow(1 - k / 10, 3);
    win.alphaValue = p;
    win.setFrameOrigin($.NSMakePoint(x, y + 10 * (1 - p)));
    delay(0.016);
  }
  win.invalidateShadow;

  // Suivi du programme de copie
  globalThis.__ttWidget.timer = $.NSTimer.scheduledTimerWithTimeIntervalTargetSelectorUserInfoRepeats(0.15, handler, 'tick:', null, true);
}
