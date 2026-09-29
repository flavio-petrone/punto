'use strict';
(() => {
  const section = document.querySelector('[data-product-film]');
  if (!section) return;
  const video = section.querySelector('video');
  const button = section.querySelector('[data-film-toggle]');
  const label = button.querySelector('[data-film-label]');
  const symbol = button.querySelector('[data-film-symbol]');
  const progress = section.querySelector('[data-film-progress]');
  const time = section.querySelector('[data-film-time]');
  const status = section.querySelector('[data-film-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  let loaded = false;
  let inView = false;
  let wantsPlay = !reduced.matches && !connection?.saveData;
  let globallyPaused = false;
  let pendingPlay = false;
  let playVersion = 0;
  let error = false;

  function update() {
    const playing = !video.paused && !video.ended;
    label.textContent = globallyPaused
      ? 'Animazioni in pausa'
      : error
        ? 'Riprova il film'
        : playing
          ? 'Pausa il film'
          : 'Riproduci il film';
    symbol.textContent = playing ? 'Ⅱ' : '▷';
    button.disabled = globallyPaused;
    button.setAttribute('aria-label', label.textContent);
    const duration = Number.isFinite(video.duration) ? video.duration : 10;
    const current = video.currentTime || 0;
    progress.style.transform = `scaleX(${Math.min(current / duration, 1)})`;
    const format = (seconds) => `0:${String(Math.floor(seconds)).padStart(2, '0')}`;
    time.textContent = `${format(current)} / ${format(duration)}`;
  }
  function load() {
    if (loaded) return;
    const compact = matchMedia('(max-width: 700px)').matches || connection?.saveData;
    video.src = compact ? video.dataset.mobileSrc : video.dataset.src;
    loaded = true;
    video.load();
  }
  function mayPlay() {
    return wantsPlay && inView && !document.hidden && !globallyPaused;
  }
  async function sync() {
    if (!mayPlay()) {
      playVersion += 1;
      video.pause();
      update();
      return;
    }
    if (pendingPlay || !video.paused) return;
    load();
    pendingPlay = true;
    const version = ++playVersion;
    try {
      await video.play();
      if (!mayPlay()) video.pause();
      if (version === playVersion) status.textContent = '';
    } catch (failure) {
      if (version === playVersion && failure.name !== 'AbortError') {
        wantsPlay = false;
        status.textContent = 'Premi Riproduci per avviare il film.';
      }
    } finally {
      pendingPlay = false;
      update();
    }
  }
  button.addEventListener('click', () => {
    if (globallyPaused) return;
    if (!video.paused) {
      wantsPlay = false;
      sync();
      return;
    }
    if (error) {
      error = false;
      loaded = false;
    }
    wantsPlay = true;
    status.textContent = '';
    sync();
  });
  video.addEventListener('error', () => {
    error = true;
    wantsPlay = false;
    status.textContent =
      'Il film non è disponibile. Puoi riprovare o proseguire verso il workspace.';
    update();
  });
  ['play', 'pause', 'timeupdate', 'loadedmetadata'].forEach((event) =>
    video.addEventListener(event, update),
  );
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('punto:motion', ({ detail }) => {
    globallyPaused = detail.paused;
    sync();
  });
  reduced.addEventListener('change', () => {
    wantsPlay = !reduced.matches && !connection?.saveData;
    sync();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.3 },
    ).observe(video);
  } else {
    inView = true;
    wantsPlay = false;
  }
  video.muted = true;
  update();
})();
