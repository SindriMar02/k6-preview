/* ============================================================
   K6 VEITINGAR, v3 "Blaðið". Vanilla, no smooth-scroll library.
   Native scroll; IntersectionObserver for entries, ONE passive scroll
   handler doing transform-only work. Every duration lives in CSS on
   the golden-ratio ladder. Reduced motion renders every state at rest.
   ============================================================ */
(function () {
  'use strict';
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  if (!('IntersectionObserver' in window)) document.documentElement.classList.add('no-io');

  /* 1. the folio line: today's date in Icelandic, no library (Intl has no Icelandic) */
  function folio() {
    var el = $('[data-date]'); if (!el) return;
    var days = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
    var months = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
    var d = new Date(new Date().toLocaleString("en-US", {timeZone:"Atlantic/Reykjavik"}));
    el.textContent = days[d.getDay()] + ' ' + d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* 2. per-word headline rise, words never break (Icelandic) */
  function splitWords() {
    $$('[data-words]').forEach(function (el) {
      if (el.dataset.done) return;
      var copy = el.cloneNode(true);
      $$('br',copy).forEach(function(br){br.replaceWith(document.createTextNode(' '));});
      var label = copy.textContent.trim().replace(/\s+/g, ' ');
      el.setAttribute('aria-label', label);
      var i = 0;
      el.innerHTML = label.split(' ').map(function (w) {
        return '<span class="w" aria-hidden="true"><span style="--i:' + (i++) + '">' + w + '</span></span>';
      }).join(' ');
      el.dataset.done = '1';
    });
  }


  /* 2b. THE FITTER. Icelandic sets compound words like "matreidslumanninum" and
        "PIZZASMIDJAN" that are far wider than an English word at the same size, so a
        display scale that is safe in English clips here. Every display element is
        measured against its own box and only the offender shrinks. Two modes:
        WORD  - the longest word must fit (headings, which may wrap)
        LINE  - the whole string must fit a target share of its container (the
                masthead wordmark and the outline footer word, which never wrap). */
  var probe = null;
  function measure(el, text) {
    if (!probe) {
      probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0;padding:0;margin:0';
      document.body.appendChild(probe);
    }
    var cs = getComputedStyle(el);
    probe.style.fontFamily = cs.fontFamily; probe.style.fontWeight = cs.fontWeight;
    probe.style.fontStyle = cs.fontStyle; probe.style.fontSize = cs.fontSize;
    probe.style.letterSpacing = cs.letterSpacing; probe.style.wordSpacing = cs.wordSpacing; probe.style.textTransform = cs.textTransform;
    probe.style.fontVariant = cs.fontVariant;
    probe.textContent = text;
    return probe.getBoundingClientRect().width;
  }
  function fitWord(el) {
    el.style.fontSize = '';
    var avail = el.clientWidth; if (!avail) return;
    var cs = getComputedStyle(el);
    avail -= parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
    var words = (el.getAttribute('aria-label') || el.textContent).split(/[\s|]+/).filter(Boolean);
    var widest = 0;
    for (var i = 0; i < words.length; i++) widest = Math.max(widest, measure(el, words[i]));
    if (widest > avail) el.style.fontSize = (parseFloat(cs.fontSize) * (avail / widest) * 0.99).toFixed(2) + 'px';
  }
  function fitLine(el, box, ratio, cap, cssVar) {
    el.style.setProperty(cssVar, '');
    var bw = box.clientWidth || box.getBoundingClientRect().width;
    var avail = bw * ratio;
    if (!avail) return;
    var w = measure(el, (el.getAttribute('aria-label') || el.textContent).replace(/[\u2726\u00b7]/g, '').replace(/\s+/g, ' ').trim());
    if (!w) return;
    var next = parseFloat(getComputedStyle(el).fontSize) * (avail / w);
    /* CAP the fitted size. Filling the measure with every name would set RUB 23 at
       351px against PIZZASMIDJAN at 158px and the four papers would read as four
       different scales. The ceiling is set by the longest name in the family, so
       short names repeat across the band instead of ballooning. */
    next = Math.min(next, bw * cap);
    box.style.setProperty(cssVar, next.toFixed(2) + 'px');
  }
  function fitType() {
    /* the masthead word: one complete name occupies ~82% of the page, so a whole
       name is always legible as the band moves. */
    $$('.masthead').forEach(function (m) {
      var w = $('.wordmark', m); if (!w) return;
      /* reserve the postmark's column so it never lands on the last letter */
      var st = $('.stamp--mark', m), bw = m.clientWidth;
      var reserve = st ? st.getBoundingClientRect().width + bw * 0.015 : 0;
      fitLine(w, m, Math.max(0.5, (bw - reserve) / bw) * 0.94, 0.135, '--word-fs');
    });
    $$('.foot__word').forEach(function (f) { fitLine(f, f, 0.96, 0.145, '--foot-fs'); });
    $$('.display, .menuword, .pick__name, .ad__n, .nums b, .sib__n').forEach(fitWord);
  }

  /* One owner per reveal. Only content below the initial viewport is armed. */
  var activeAnimations = new Set(), entryAnimations = new WeakMap(), revealObserver = null;
  function finishReveal(el) {
    el.dataset.entryState = 'done';
    el.classList.add('is-in');
    if (el.matches('.pick')) el.classList.add('is-photo');
    var running=entryAnimations.get(el);
    if(running){entryAnimations.delete(el);running.cancel();activeAnimations.delete(running);}
    if (revealObserver) revealObserver.unobserve(el);
  }
  function revealNow(el, delay) {
    if (el.dataset.entryState !== 'pending') return;
    if (RM || el.dataset.revealImmediate) { finishReveal(el); return; }
    el.dataset.entryState = 'playing';
    el.classList.add('is-in');
    if (el.matches('.pick')) el.classList.add('is-photo');
    if (el.dataset.entryKind === 'rise' && el.animate) {
      var animation = el.animate([
        {opacity:0, transform:'translate3d(0,24px,0)'},
        {opacity:1, transform:'translate3d(0,0,0)'}
      ], {duration:650, delay:delay, easing:'cubic-bezier(.23,1,.32,1)', fill:'both'});
      activeAnimations.add(animation);
      entryAnimations.set(el,animation);
      animation.finished.catch(function(){}).finally(function(){
        finishReveal(el); animation.cancel(); activeAnimations.delete(animation);
      });
    } else {
      // CSS owns word masks and photo shutters; never animate their parent too.
      setTimeout(function(){finishReveal(el);},1400);
    }
  }
  function reveals() {
    var selector = '.reveal,[data-rise],.rule,.stamp,[data-words],[data-in],.pick,.ad';
    var targets = new Set($$(selector));
    $$('[data-reveal-group]').forEach(function(group){
      if(group.matches('.ads')) return;
      Array.from(group.children).forEach(function(child){
        if(!child.matches('[data-reveal-group]') && !child.querySelector(selector)) targets.add(child);
      });
    });
    // Containers with independently revealed descendants stay stationary.
    Array.from(targets).forEach(function(el){
      if(Array.from(targets).some(function(other){return other!==el && el.contains(other);})) {
        targets.delete(el);
      }
    });
    var els = Array.from(targets);
    if(RM || !('IntersectionObserver' in window)) {
      $$(selector).forEach(finishReveal); return;
    }
    document.documentElement.classList.add('motion-preparing','motion-ready');
    els.forEach(function(el){
      el.dataset.entryKind = el.matches('.reveal,[data-words],.rule,.stamp') ? 'special' : 'rise';
      // Never hide something the visitor has already seen (including deep links).
      if(el.getBoundingClientRect().top < innerHeight || el.dataset.revealImmediate) finishReveal(el);
      else el.dataset.entryState = 'pending';
    });
    // Commit hidden starts with transitions disabled, then arm the observer.
    void document.documentElement.offsetHeight;
    document.documentElement.classList.remove('motion-preparing');
    revealObserver = new IntersectionObserver(function(entries){
      var entering=entries.filter(function(entry){return entry.isIntersecting;});
      entering.forEach(function(entry,i){
        var el=entry.target;
        revealObserver.unobserve(el);
        var pictures=$$('img',el);
        Promise.all(pictures.map(function(img){return img.decode ? img.decode().catch(function(){}) : Promise.resolve();})).then(function(){
          revealNow(el,Math.min(i*70,140));
        });
      });
    },{rootMargin:'0px 0px 48px 0px',threshold:0});
    els.filter(function(el){return el.dataset.entryState==='pending';}).forEach(function(el){revealObserver.observe(el);});
    // Keyboard focus and browser restoration must never land on hidden controls.
    document.addEventListener('focusin',function(e){
      var el=e.target.closest('[data-entry-state="pending"]');if(el)finishReveal(el);
    });
    window.addEventListener('pageshow',function(e){if(e.persisted)els.forEach(finishReveal);});
  }

  /* 4. postmark stamps, built from data attributes so every page shares one drawing */
  function stamps() {
    $$('[data-stamp]').forEach(function (el) {
      var ring = el.dataset.stamp, mid = el.dataset.stampMid || '', sub = el.dataset.stampSub || '';
      var id = 'sp' + Math.random().toString(36).slice(2, 7);
      el.innerHTML =
        '<svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<defs><path id="' + id + '" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0"/></defs>' +
        '<circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
        '<circle cx="50" cy="50" r="43.5" fill="none" stroke="currentColor" stroke-width=".7"/>' +
        '<circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" stroke-width=".8"/>' +
        '<text font-family="Playfair,Georgia,serif" font-weight="700" font-size="8.2" letter-spacing="1.4" fill="currentColor"><textPath href="#' + id + '" startOffset="0">' + ring + '</textPath></text>' +
        '<text x="50" y="47" text-anchor="middle" font-family="Playfair,Georgia,serif" font-weight="800" font-size="' + (mid.length > 4 ? 11 : 16) + '" fill="currentColor">' + mid + '</text>' +
        '<text x="50" y="58" text-anchor="middle" font-family="Playfair,Georgia,serif" font-style="italic" font-weight="600" font-size="5.2" fill="currentColor">' + sub + '</text>' +
        '<line x1="30" y1="63" x2="70" y2="63" stroke="currentColor" stroke-width=".6"/>' +
        '</svg>';
    });
  }

  /* 5. the engraving: their photograph redrawn as ink hatching (the Bárujárn raster,
        turned horizontal so it reads as a newspaper engraving). Drawn once per size. */
  function engrave(host) {
    var img = $('img', host), cv = $('canvas', host); if (!img || !cv) return;
    var lastSize='',resizeObserver=null;
    var ink = getComputedStyle(host.closest('.pick') || host).getPropertyValue('--pk').trim() || '#1E1B18';
    var paper = getComputedStyle(document.body).getPropertyValue('--paper').trim() || '#F7F4EC';
    function draw() {
      if(host.closest('.is-photo')){if(resizeObserver)resizeObserver.disconnect();return;}
      var W = host.clientWidth, H = host.clientHeight; if (!W || !H || !img.naturalWidth) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      var size=W+':'+H+':'+dpr;if(size===lastSize)return;lastSize=size;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
      var gap = W > 700 ? 5 : 4, step = 2;                 // line pitch, sample pitch along the line
      var cols = Math.ceil(W / step), rows = Math.ceil(H / gap);
      var off = document.createElement('canvas'); off.width = cols; off.height = rows;
      var oc = off.getContext('2d');
      var iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(W / iw, H / ih);
      var sw = W / s, sh = H / s, sx = (iw - sw) / 2, sy = (ih - sh) / 2;   // object-fit: cover
      oc.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
      var d = oc.getImageData(0, 0, cols, rows).data;
      /* NORMALISE first. A dark photograph (the sushi pass, the oven) has almost no
         high-luminance pixels, so a fixed curve inks every line to full width and the
         panel reads as a solid red block instead of an engraving. Stretch each
         photograph's own 2nd-98th percentile across the range before ruling it. */
      var n = cols * rows, hist = new Uint32Array(256), lums = new Float32Array(n), k;
      for (k = 0; k < n; k++) {
        var L = (0.2126 * d[k * 4] + 0.7152 * d[k * 4 + 1] + 0.0722 * d[k * 4 + 2]) / 255;
        lums[k] = L; hist[(L * 255) | 0]++;
      }
      var lo = 0, hi = 255, acc = 0, cut = n * 0.02;
      for (k = 0; k < 256; k++) { acc += hist[k]; if (acc >= cut) { lo = k; break; } }
      acc = 0;
      for (k = 255; k >= 0; k--) { acc += hist[k]; if (acc >= cut) { hi = k; break; } }
      var span = Math.max(1, hi - lo) / 255, base = lo / 255;
      ctx.fillStyle = ink;
      for (var r = 0; r < rows; r++) {
        var y = r * gap + gap / 2;
        for (var c = 0; c < cols; c++) {
          var lum = Math.min(1, Math.max(0, (lums[r * cols + c] - base) / span));
          var dark = Math.pow(1 - lum, 1.95) * 0.96;   /* higher exponent keeps paper in the mid-tones */
          var t = dark * (gap - 1.1);
          if (t > 0.25) ctx.fillRect(c * step, y - t / 2, step + 0.3, t);
        }
      }
    }
    if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
    if ('ResizeObserver' in window) { var t; resizeObserver=new ResizeObserver(function () { clearTimeout(t); t = setTimeout(draw, 120); });resizeObserver.observe(host); }
  }
  function engravings() { $$('[data-engrave]').forEach(engrave); }

  /* SRG reference: hero top/top → bottom/top drift; native scrolling keeps touch direct.
     One scheduled read/write pass per scroll, never an idle animation loop. */
  var tracks=[],drifts=[],bar=null,barControls=[],barShown=null,mastH=0,scrollFrame=0;
  function buildMarquees(){
    $$('.ticker').forEach(function(m){
      var track=$('.ticker__track',m),unit=track&&track.firstElementChild;if(!unit||!track.animate)return;
      var animation=null,width=0,copies=0,inView=false,paused=false,buttonState="";
      var button=document.createElement('button');button.type='button';button.className='ticker__toggle';
      m.removeAttribute('aria-hidden');track.setAttribute('aria-hidden','true');m.appendChild(button);
      function sync(){
        var state=String(RM)+String(paused);
        if(state!==buttonState){buttonState=state;button.hidden=RM;button.textContent=paused?'▶':'Ⅱ';
          button.setAttribute('aria-label',paused?'Ræsa tilkynningaborða':'Stöðva tilkynningaborða');}
        if(!animation)return;
        var shouldPause=RM||paused||!inView||document.hidden;
        if(shouldPause&&animation.playState!=='paused')animation.pause();
        else if(!shouldPause&&animation.playState!=='running')animation.play();
      }
      function measure(){
        var next=unit.getBoundingClientRect().width;if(!next)return;
        var nextCopies=Math.ceil(m.clientWidth/next);
        if(animation&&Math.abs(next-width)<0.1&&nextCopies===copies){sync();return;}
        var progress=animation?(Number(animation.currentTime)||0)/(width/28*1000)%1:0;
        if(animation)animation.cancel();width=next;copies=nextCopies;
        while(track.children.length>1)track.lastElementChild.remove();
        for(var i=0;i<copies;i++)track.appendChild(unit.cloneNode(true));
        animation=track.animate([{transform:'translate3d(0,0,0)'},{transform:'translate3d('+(-width)+'px,0,0)'}],
          {duration:width/28*1000,iterations:Infinity,easing:'linear'});
        animation.currentTime=RM?0:progress*(width/28*1000);sync();
      }
      button.addEventListener('click',function(){paused=!paused;sync();});
      if('IntersectionObserver' in window)new IntersectionObserver(function(es){inView=es[0].isIntersecting;sync();}).observe(m);
      else inView=true;
      document.addEventListener('visibilitychange',sync);
      matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',function(e){RM=e.matches;measure();});
      if('ResizeObserver' in window){var observer=new ResizeObserver(measure);observer.observe(unit);observer.observe(m);}
      else window.addEventListener('resize',measure,{passive:true});
      if(document.fonts)document.fonts.ready.then(measure);
      measure();tracks.push({el:track,frame:m});
    });
  }
  function collectDrifts(){
    $$('[data-parallax]').forEach(function(f){var m=$('img,video',f);if(m){m.style.transition='none';drifts.push({frame:f,m:m,hero:false});}});
    $$('[data-hero]').forEach(function(f){var m=$('.hero-media',f);if(m)drifts.push({frame:f,m:m,hero:true});});
  }
  function onScroll(){
    scrollFrame=0;
    var y=window.scrollY,vh=innerHeight;
    var show=y>mastH+100;
    // Read geometry before any DOM writes; navigation changes only at its threshold.
    var values=RM?[]:drifts.map(function(d){return {d:d,r:d.frame.getBoundingClientRect()};});
    if(bar&&show!==barShown){barShown=show;bar.classList.toggle('is-on',show);bar.inert=!show;bar.setAttribute('aria-hidden',String(!show));
      barControls.forEach(function(el){el.tabIndex=show?0:-1;});}
    values.forEach(function(v){
      if(v.r.bottom<0||v.r.top>vh)return;
      var progress=Math.max(0,Math.min(1,-v.r.top/v.r.height));
      var offset=v.d.hero?progress*18:((v.r.top+v.r.height/2-vh/2)/vh)*7;
      var transform='translate3d(0,'+offset.toFixed(3)+'%,0) scale(1.12)';
      if(v.d.lastTransform!==transform){v.d.lastTransform=transform;v.d.m.style.transform=transform;}
    });
  }
  function scheduleScroll(){if(!scrollFrame)scrollFrame=requestAnimationFrame(onScroll);}
  /* 9. directional button fill: the ink enters from the side the cursor came from */
  function buttonSide() {
    if (!FINE) return;
    $$('.btn').forEach(function (b) {
      b.addEventListener('mouseenter', function (e) { var r = b.getBoundingClientRect(); b.style.setProperty('--ox', (e.clientX - r.left) < r.width / 2 ? 'left' : 'right'); });
    });
  }

  /* 10. the configurator (rub23): hráefni × rub typesets a headline */
  function configurator() {
    var root = $('[data-cfg]'); if (!root) return;
    var out = $('.cfg__out .display', root), desc = $('.cfg__out .cfg__desc', root);
    var sel = { base: null, rub: null };
    function paint() {
      if (!sel.base || !sel.rub) return;
      out.innerHTML = sel.base.dataset.name + ' <em>með</em> ' + sel.rub.dataset.name;
      desc.textContent = sel.rub.dataset.desc;
      out.classList.add('is-in'); fitWord(out);
    }
    $$('.chips', root).forEach(function (group) {
      var key = group.dataset.axis;
      group.addEventListener('click', function (e) {
        var c = e.target.closest('.chip'); if (!c) return;
        $$('.chip', group).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', 'true'); sel[key] = c; paint();
      });
      var first = $('.chip', group); if (first) { first.setAttribute('aria-pressed', 'true'); sel[key] = first; }
      // Native phone pickers keep all six ingredients and eleven blends within reach.
      var field=document.createElement('div');field.className='cfg__mobile';
      var label=document.createElement('label'),select=document.createElement('select');
      select.id='choose-'+key;select.name=key;label.htmlFor=select.id;
      label.textContent=key==='base'?'1. Veldu hráefni':'2. Veldu kryddblöndu';
      $$('.chip',group).forEach(function(chip){var option=document.createElement('option');option.value=chip.dataset.name;option.textContent=chip.dataset.name;select.appendChild(option);});
      select.addEventListener('change',function(){var chip=$$('.chip',group).find(function(c){return c.dataset.name===select.value;});if(chip)chip.click();});
      group.addEventListener('click',function(e){var chip=e.target.closest('.chip');if(chip)select.value=chip.dataset.name;});
      field.append(label,select);group.parentElement.insertAdjacentElement('afterend',field);
    });
    root.classList.add('cfg-mobile-enhanced');
    paint();
  }

  /* 11. menu overlay */
  function mobileMenu(){
    var burgers=$$('[data-burger]'),menu=$('[data-menu]');if(!burgers.length||!menu)return;
    var overflow='';
    burgers.forEach(function(b){b.addEventListener('click',function(e){
      overflow=document.documentElement.style.overflow;menu.showModal();document.documentElement.style.overflow='hidden';
      burgers.forEach(function(x){x.setAttribute('aria-expanded','true');});
      if(e.detail&&!RM){var a=menu.animate([{opacity:.5,transform:'translate3d(0,-24px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:240,easing:'cubic-bezier(.23,1,.32,1)'});activeAnimations.add(a);a.finished.catch(function(){}).finally(function(){activeAnimations.delete(a);});}
    });});
    $$('[data-menu-close],a',menu).forEach(function(el){el.addEventListener('click',function(){menu.close();});});
    menu.addEventListener('close',function(){document.documentElement.style.overflow=overflow;burgers.forEach(function(b){b.setAttribute('aria-expanded','false');});});
  }

  /* 12. live open / closed from data-hours */
  function liveStatus() {
    var now = new Date(new Date().toLocaleString("en-US", {timeZone:"Atlantic/Reykjavik"})), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    $$('[data-hours]').forEach(function (el) {
      var spec; try { spec = JSON.parse(el.dataset.hours); } catch (e) { return; }
      var today = spec[String(day)], open = false;
      if (Array.isArray(today)) for (var i = 0; i < today.length; i++) {
        var a = today[i][0].split(':'), b = today[i][1].split(':');
        if (mins >= (+a[0]) * 60 + (+a[1]) && mins < (+b[0]) * 60 + (+b[1])) { open = true; break; }
      }
      el.dataset.open = open ? 'true' : 'false';
      el.textContent = open ? (el.dataset.labelOpen || 'Opið núna') : (el.dataset.labelClosed || 'Lokað núna');
    });
  }

  /* Real photographs, six-second holds; no camera movement or video decoder. */
  function film(){
    var root=$('[data-slideshow]');if(!root)return;
    var slides=$$('.hero-slide',root),pause=$('[data-slide-pause]'),next=$('[data-slide-next]'),label=$('[data-slide-label]');
    var current=0,timer=null,inView=false,paused=RM,request=0;
    function schedule(){
      clearTimeout(timer);
      if(!paused&&inView&&!document.hidden)timer=setTimeout(advance,6000);
    }
    function advance(){
      clearTimeout(timer);var token=++request,index=(current+1)%slides.length,img=slides[index];
      (img.decode?img.decode():Promise.resolve()).then(function(){
        if(token!==request)return;
        slides[current].classList.remove('is-current');slides[current].setAttribute('aria-hidden','true');
        img.classList.add('is-current');img.removeAttribute('aria-hidden');current=index;
        label.textContent=img.dataset.place;schedule();
      }).catch(function(){schedule();});
    }
    function sync(){
      request++;pause.textContent=paused?'Ræsa myndasýningu':'Gera hlé';schedule();
    }
    pause.hidden=false;next.hidden=false;
    pause.addEventListener('click',function(){paused=!paused;sync();});
    next.addEventListener('click',advance);
    if('IntersectionObserver' in window)new IntersectionObserver(function(entries){inView=entries[0].isIntersecting;sync();},{threshold:.05}).observe(root.closest('.film'));
    else {inView=true;sync();}
    document.addEventListener('visibilitychange',sync);
    matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',function(e){paused=e.matches;sync();});
  }

  function menuBrowser(){
    var menu=$('[data-menu-browser]');if(!menu)return;
    var section=menu.closest('section'),buttons=$$('[data-menu-filter]',section),items=$$('[data-menu-category]',menu);
    var pizza=menu.classList.contains('ads'),mobile=matchMedia('(max-width:959px)');
    var params=new URLSearchParams(location.search);
    var choice=params.get('category')||(pizza?'all':items[0].dataset.menuCategory);
    if(choice!=='all'&&!items.some(function(item){return item.dataset.menuCategory===choice;}))choice=pizza?'all':items[0].dataset.menuCategory;
    var search=$('input[type=search]',section),empty=$('.menu-empty',section);
    function normalize(value){return value.toLocaleLowerCase('is').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
    if(search){search.closest('.menu-search').hidden=false;search.value=params.get('q')||'';}
    function saveChoice(){
      var url=new URL(location.href);url.searchParams.set('category',choice);
      if(search&&search.value.trim())url.searchParams.set('q',search.value.trim());else url.searchParams.delete('q');
      history.replaceState(null,'',url);
    }
    function show(immediate){
      var selected=(!pizza&&!mobile.matches)?'all':choice;
      var query=search?normalize(search.value.trim()):'';
      items.forEach(function(item){item.hidden=(selected!=='all'&&item.dataset.menuCategory!==selected)||(!!query&&!normalize(item.textContent).includes(query));});
      buttons.forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.menuFilter===selected));});
      var count=items.filter(function(item){return !item.hidden;}).reduce(function(n,item){return n+(pizza?1:$$('.dish',item).length);},0);
      $('.menu-count',section).textContent=pizza?count+(count===1?' pizza':' pizzur'):count+(count===1?' réttur':' réttir');
      if(empty)empty.hidden=count!==0;
      // Switching a category is an immediate, user-controlled operation.
      if(immediate)items.filter(function(item){return !item.hidden;}).forEach(function(item){item.dataset.revealImmediate='true';finishReveal(item);});
    }
    section.classList.add('menu-enhanced');
    buttons.forEach(function(button){button.addEventListener('click',function(){choice=button.dataset.menuFilter;show(true);saveChoice();});});
    if(search)search.addEventListener('input',function(){show(true);saveChoice();});
    var reset=$('[data-menu-reset]',section);if(reset)reset.addEventListener('click',function(){search.value='';choice='all';show(true);saveChoice();search.focus();});
    mobile.addEventListener('change',function(){show(true);});show(false);
  }

  function init() {
    folio(); splitWords(); fitType(); stamps(); menuBrowser(); mobileMenu(); configurator(); engravings(); buttonSide(); film();
    var statusTimer;
    function statusClock(){clearInterval(statusTimer);if(!document.hidden){liveStatus();statusTimer=setInterval(liveStatus,60000);}}
    document.addEventListener('visibilitychange',statusClock);statusClock();
    bar = $('.bar'); barControls=bar?$$('a,button',bar):[]; var mast = $('.mast'); mastH = mast ? mast.offsetHeight : 0;
    buildMarquees(); collectDrifts(); onScroll();
    window.addEventListener('scroll', scheduleScroll, { passive: true });
    var rt, layoutWidth=innerWidth; window.addEventListener('resize', function () {
      if(innerWidth===layoutWidth){scheduleScroll();return;}
      layoutWidth=innerWidth;clearTimeout(rt);rt=setTimeout(function(){fitType();mastH=mast?mast.offsetHeight:0;scheduleScroll();},160);
    }, {passive:true});
    function prepareMotion(){fitType();reveals();}
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(prepareMotion);else prepareMotion();

    requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('is-lit'); }); });
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',function(e){RM=e.matches;if(RM){$$('[data-entry-state]').forEach(finishReveal);activeAnimations.forEach(function(a){a.cancel();});drifts.forEach(function(d){d.lastTransform=null;d.m.style.transform='none';});tracks.forEach(function(t){t.el.style.transform='none';});$$('.film video').forEach(function(v){v.pause();});}scheduleScroll();});
    window.__k6 = { onScroll: onScroll, fitType: fitType, tracks: tracks, drifts: drifts, rm: RM };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
