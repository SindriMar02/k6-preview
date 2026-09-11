(function(){
  'use strict';

  var root=document.documentElement;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $=function(selector,scope){return (scope||document).querySelector(selector);};
  var $$=function(selector,scope){return Array.from((scope||document).querySelectorAll(selector));};

  function finishReady(){
    root.classList.add('motion-ready');
    root.classList.remove('motion-fallback');
  }

  function routeCurtain(){
    var curtain=$('.route-curtain');
    if(!curtain)return;
    if(reduce){root.classList.remove('route-arriving');return;}
    var arriving=root.classList.contains('route-arriving');
    var leaving=false;
    if(arriving){
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){curtain.classList.add('is-entering');});
      });
      curtain.addEventListener('animationend',function(event){
        if(event.animationName!=='curtain-enter')return;
        curtain.classList.remove('is-entering');
        root.classList.remove('route-arriving');
      },{once:true});
    }
    window.addEventListener('pageshow',function(event){
      if(!event.persisted)return;
      leaving=false;
      curtain.classList.remove('is-leaving','is-entering');
      root.classList.remove('route-arriving');
    });
    document.addEventListener('click',function(event){
      var link=event.target.closest('a[href]');
      if(!link||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      var href=link.getAttribute('href');
      if(!href||href.charAt(0)==='#'||link.target==='_blank'||link.hasAttribute('download'))return;
      var destination=new URL(link.href,location.href);
      if(destination.origin!==location.origin||destination.pathname===location.pathname)return;
      event.preventDefault();
      if(leaving)return;
      leaving=true;
      try{sessionStorage.setItem('k6-route-entry','1');}catch(error){}
      curtain.classList.remove('is-entering');
      curtain.classList.add('is-leaving');
      setTimeout(function(){location.href=destination.href;},620);
    });
  }

  function homepageLoader(){
    var loader=$('[data-site-loader]');
    if(!loader)return;
    if(root.classList.contains('route-arriving')){
      root.classList.add('site-intro-revealed');
      root.classList.remove('site-intro-pending');
      loader.remove();
      return;
    }
    var finished=false;
    var started=performance.now();
    var hero=$('.hero-slide.is-current');
    requestAnimationFrame(function(){loader.classList.add('is-active');});
    function dismiss(){
      if(finished)return;
      finished=true;
      root.classList.add('site-intro-revealed');
      root.classList.remove('site-intro-pending');
      loader.classList.add('is-complete');
      document.dispatchEvent(new CustomEvent('k6:intro-ready'));
      setTimeout(function(){loader.remove();},680);
    }
    var imageReady=hero&&hero.decode?hero.decode().catch(function(){}):Promise.resolve();
    var fontReady=document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve();
    Promise.all([imageReady,fontReady]).then(function(){
      var minimum=reduce?120:760;
      setTimeout(dismiss,Math.max(0,minimum-(performance.now()-started)));
    });
    setTimeout(dismiss,reduce?500:1700);
  }

  function mobileMenu(){
    var panel=$('[data-menu]');
    var open=$('[data-menu-open]');
    var close=$('[data-menu-close]');
    if(!panel||!open)return;
    var closing=false;
    var closeTimer=0;
    var restoreMenuFocus=false;
    function show(){
      clearTimeout(closeTimer);
      closing=false;
      panel.classList.remove('is-closing');
      if(!panel.open)panel.showModal();
      document.body.classList.add('menu-open');
      open.setAttribute('aria-expanded','true');
      if(reduce){panel.classList.add('is-visible');return;}
      requestAnimationFrame(function(){requestAnimationFrame(function(){panel.classList.add('is-visible');});});
    }
    function finishHide(){
      clearTimeout(closeTimer);
      if(panel.open)panel.close();
      panel.classList.remove('is-visible','is-closing');
      closing=false;
      if(restoreMenuFocus&&document.contains(open))requestAnimationFrame(function(){open.focus({preventScroll:true});});
      restoreMenuFocus=false;
    }
    function hide(restoreFocus){
      if(!panel.open||closing)return;
      restoreMenuFocus=restoreFocus!==false;
      if(reduce){finishHide();return;}
      closing=true;
      panel.classList.add('is-closing');
      panel.classList.remove('is-visible');
      closeTimer=setTimeout(finishHide,220);
    }
    open.addEventListener('click',show);
    if(close)close.addEventListener('click',function(){hide(true);});
    $$('a',panel).forEach(function(link){link.addEventListener('click',function(){hide(false);});});
    panel.addEventListener('click',function(event){if(event.target===panel)hide(true);});
    panel.addEventListener('cancel',function(event){event.preventDefault();hide(true);});
    panel.addEventListener('close',function(){document.body.classList.remove('menu-open');open.setAttribute('aria-expanded','false');});
  }

  function heroSlideshow(){
    var stage=$('[data-slideshow]');
    if(!stage)return;
    var slides=$$('.hero-slide',stage);
    var button=$('[data-slide-toggle]');
    var label=$('[data-slide-label]');
    var current=0;
    var timer=0;
    var paused=reduce;
    var visible=true;
    function schedule(){clearTimeout(timer);if(!paused&&visible&&!document.hidden)timer=setTimeout(next,5400);}
    function paint(index){
      slides[current].classList.remove('is-current');
      slides[current].setAttribute('aria-hidden','true');
      current=index;
      var active=slides[current];
      active.classList.add('is-current');
      active.removeAttribute('aria-hidden');
      if(label)label.textContent=active.dataset.place||'';
      // Crossfade owns opacity; scroll motion owns the image transform.
      schedule();
    }
    function next(){paint((current+1)%slides.length);}
    function sync(){
      if(button){button.classList.toggle('is-paused',paused||!visible||document.hidden);button.setAttribute('aria-pressed',String(paused));$('.slide-state',button).textContent=paused?'Ræsa':'Gera hlé';}
      schedule();
    }
    if(button)button.addEventListener('click',function(){paused=!paused;sync();});
    if('IntersectionObserver' in window)new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;sync();},{threshold:.05}).observe(stage);
    document.addEventListener('visibilitychange',sync);
    sync();
  }

  function rails(){
    $$('[data-rail-controls]').forEach(function(controls){
      var target=document.getElementById(controls.dataset.railControls);
      if(!target)return;
      $$('[data-rail-step]',controls).forEach(function(button){
        button.addEventListener('click',function(){
          var direction=button.dataset.railStep==='next'?1:-1;
          var card=target.firstElementChild;
          var amount=card?card.getBoundingClientRect().width+16:target.clientWidth*.8;
          target.scrollBy({left:amount*direction,behavior:reduce?'auto':'smooth'});
        });
      });
    });
  }

  function menuBrowsers(){
    $$('[data-menu-browser]').forEach(function(menu){
      var section=menu.closest('section');
      var items=$$('[data-menu-category]',menu);
      var buttons=$$('[data-menu-filter]',section);
      var filters=$('.filter-group',section);
      var search=$('[data-menu-search]',section);
      var count=$('[data-menu-count]',section);
      var choice='all';
      var filterTimer=0;
      function normalise(value){return value.toLocaleLowerCase('is').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
      function positionFilter(instant){
        if(!filters)return;
        var active=buttons.find(function(button){return button.dataset.menuFilter===choice;});
        if(!active)return;
        if(instant)filters.classList.add('is-positioning');
        filters.style.setProperty('--filter-x',active.offsetLeft+'px');
        filters.style.setProperty('--filter-w',active.offsetWidth+'px');
        filters.classList.add('is-enhanced');
        if(instant)requestAnimationFrame(function(){filters.classList.remove('is-positioning');});
      }
      function revealItems(visible){
        if(reduce)return;
        visible.forEach(function(item,index){
          if(!item.animate)return;
          if(item.getAnimations)item.getAnimations().forEach(function(animation){animation.cancel();});
          item.animate([{opacity:.24,transform:'translate3d(0,8px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:280,delay:Math.min(index,5)*24,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
        });
        if(count&&count.animate)count.animate([{opacity:.25,transform:'translate3d(0,4px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
      }
      function paint(animate){
        var query=search?normalise(search.value.trim()):'';
        var shown=0;
        var visibleItems=[];
        if(animate&&filters&&!reduce){
          clearTimeout(filterTimer);
          filters.classList.add('is-moving');
          filterTimer=setTimeout(function(){filters.classList.remove('is-moving');},290);
        }
        items.forEach(function(item){
          var visible=(choice==='all'||item.dataset.menuCategory===choice)&&(!query||normalise(item.textContent).includes(query));
          item.hidden=!visible;
          if(visible){shown+=item.matches('.course')?$$('.dish',item).length:1;visibleItems.push(item);}
        });
        buttons.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.menuFilter===choice));});
        if(count){var pizza=menu.classList.contains('pizza-grid');count.textContent=shown+(pizza?(shown===1?' pizza':' pizzur'):(shown===1?' réttur':' réttir'));}
        positionFilter(!animate);
        if(animate)revealItems(visibleItems);
      }
      buttons.forEach(function(button){button.addEventListener('click',function(){if(choice===button.dataset.menuFilter)return;choice=button.dataset.menuFilter;paint(true);});});
      if(search)search.addEventListener('input',function(){paint(false);});
      if(filters&&window.ResizeObserver)new ResizeObserver(function(){positionFilter(true);}).observe(filters);
      section.addEventListener('input',function(){if(window.ScrollTrigger)ScrollTrigger.refresh();});
      section.addEventListener('click',function(){requestAnimationFrame(function(){if(window.ScrollTrigger)ScrollTrigger.refresh();});});
      paint(false);
    });
  }

  function spiceAccordions(){
    $$('.spice-grid .spice').forEach(function(details){
      var summary=$('summary',details);
      var panel=$(':scope > p',details);
      if(!summary||!panel||reduce)return;
      var expanded=details.open;
      var heightAnimation=null;
      var panelAnimation=null;
      details.classList.toggle('is-expanded',expanded);

      summary.addEventListener('click',function(event){
        event.preventDefault();
        var startHeight=details.getBoundingClientRect().height;
        var nextExpanded=!expanded;
        var panelStyle=panelAnimation?getComputedStyle(panel):null;
        var startOpacity=panelStyle?panelStyle.opacity:(nextExpanded?'0':'1');
        var startTransform=panelStyle?panelStyle.transform:(nextExpanded?'translate3d(0,-5px,0)':'translate3d(0,0,0)');

        if(heightAnimation)heightAnimation.cancel();
        if(panelAnimation)panelAnimation.cancel();
        expanded=nextExpanded;
        details.style.height=startHeight+'px';
        details.style.overflow='hidden';
        if(expanded)details.open=true;
        details.classList.toggle('is-expanded',expanded);
        details.classList.add('is-animating');

        var endHeight=expanded?details.scrollHeight:summary.getBoundingClientRect().height;
        heightAnimation=details.animate(
          [{height:startHeight+'px'},{height:endHeight+'px'}],
          {duration:260,easing:'cubic-bezier(.22,1,.36,1)'}
        );
        panelAnimation=panel.animate(
          expanded?[{opacity:startOpacity,transform:startTransform},{opacity:1,transform:'translate3d(0,0,0)'}]:[{opacity:startOpacity,transform:startTransform},{opacity:0,transform:'translate3d(0,-4px,0)'}],
          {duration:expanded?220:160,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}
        );

        var intended=expanded;
        heightAnimation.finished.then(function(){
          if(expanded!==intended)return;
          details.open=expanded;
          details.style.height='';
          details.style.overflow='';
          details.classList.remove('is-animating');
          panelAnimation.cancel();
          heightAnimation=null;
          panelAnimation=null;
          if(window.ScrollTrigger)ScrollTrigger.refresh();
        }).catch(function(){});
      });
    });
  }

  function liveHours(){
    var now=new Date(new Date().toLocaleString('en-US',{timeZone:'Atlantic/Reykjavik'}));
    var day=now.getDay();
    var minutes=now.getHours()*60+now.getMinutes();
    $$('[data-hours]').forEach(function(node){
      var hours;
      try{hours=JSON.parse(node.dataset.hours);}catch(error){return;}
      var open=(hours[String(day)]||[]).some(function(pair){
        var a=pair[0].split(':');var b=pair[1].split(':');
        return minutes>=(+a[0]*60 + +a[1])&&minutes<( +b[0]*60 + +b[1]);
      });
      node.textContent=open?(node.dataset.openLabel||'Opið núna'):(node.dataset.closedLabel||'Lokað núna');
      node.dataset.open=String(open);
      var today=document.createElement('span');today.className='hours-today';today.textContent=(hours[String(day)]||[]).map(function(pair){return pair.join('–');}).join(' / ')||'Lokað í dag';node.appendChild(today);
    });
  }

  function headerState(){
    var header=$('.site-header');
    var hero=$('.hero');
    if(!header||!hero)return;
    var masthead=$('.hero-heading',hero)||hero;
    var frame=0;
    function update(){
      frame=0;
      var passed=masthead.getBoundingClientRect().bottom<=header.offsetHeight;
      header.classList.toggle('is-identity-visible',passed);
      header.classList.toggle('is-solid',passed);
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(update);}
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    update();
  }

  function setupMotion(){
    if(reduce||!window.gsap||!window.ScrollTrigger){finishReady();return;}
    gsap.registerPlugin(ScrollTrigger);

    // Arm only content below the viewport. One-shot entrances avoid scrub jitter.
    var reveal=$$('[data-reveal]').filter(function(node){return node.getBoundingClientRect().top>innerHeight*.95;});
    reveal.forEach(function(node){
      var targets=node.matches('.section-head')?Array.from(node.children):[node];
      gsap.set(targets,{autoAlpha:0,y:20});
    });
    finishReady();
    reveal.forEach(function(node){
      var targets=node.matches('.section-head')?Array.from(node.children):[node];
      gsap.to(targets,{autoAlpha:1,y:0,duration:.62,stagger:.06,ease:'power3.out',scrollTrigger:{trigger:node,start:'top 90%',once:true},onComplete:function(){gsap.set(targets,{clearProps:'opacity,visibility,transform'});}});
    });
    var hero=$('.hero-stage');
    if(hero){
      var media=$$('.hero-media,.hero-slide',hero);
      gsap.fromTo(media,{yPercent:-3},{yPercent:3,ease:'none',scrollTrigger:{trigger:hero,start:'top bottom',end:'bottom top',scrub:true}});
      // Intro translation stays on the heading, leaving the photo transform with one owner.
      if(window.scrollY<10&&!$('[data-site-loader]')){
        var intro=function(){gsap.fromTo($('.hero-heading h1'),{yPercent:6,autoAlpha:.45},{yPercent:0,autoAlpha:1,duration:.85,ease:'power3.out',clearProps:'all'});};
        intro();
      }
    }
    $$('[data-parallax]').forEach(function(frame){
      if(frame.matches('.image-plate'))return;
      var image=$('img',frame);if(!image)return;
      gsap.fromTo(image,{yPercent:-3},{yPercent:3,ease:'none',scrollTrigger:{trigger:frame,start:'top bottom',end:'bottom top',scrub:true}});
    });

    if(window.Lenis&&fine&&innerWidth>768){
      var lenis=new Lenis({duration:1.2,easing:function(t){return Math.min(1,1.001-Math.pow(2,-10*t));},smoothWheel:true,anchors:true});
      lenis.on('scroll',ScrollTrigger.update);
      gsap.ticker.add(function(time){lenis.raf(time*1000);});
      gsap.ticker.lagSmoothing(0);
    }
  }

  function ribbons(){
    $$('.statement').forEach(function(section){
      var button=$('[data-ribbon-toggle]',section),visible=false,paused=reduce;
      function sync(){section.classList.toggle('is-running',visible&&!document.hidden&&!paused);section.classList.toggle('is-paused',paused);if(button){button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'Ræsa borða':'Hlé á borðum';}}
      if(button)button.addEventListener('click',function(){paused=!paused;sync();});
      new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;sync();}).observe(section);
      document.addEventListener('visibilitychange',sync);
    });
  }

  function init(){
    homepageLoader();
    ribbons();
    routeCurtain();
    mobileMenu();
    heroSlideshow();
    rails();
    menuBrowsers();
    spiceAccordions();
    liveHours();
    headerState();
    document.addEventListener('toggle',function(){if(window.ScrollTrigger)ScrollTrigger.refresh();},true);
    setupMotion();
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(window.ScrollTrigger)ScrollTrigger.refresh();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
