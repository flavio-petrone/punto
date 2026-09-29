'use strict';

(() => {
  const showcase = document.querySelector('[data-product-showcase]');
  if (!showcase) return;
  const tabs = [...showcase.querySelectorAll('[role="tab"]')];
  const panels = [...showcase.querySelectorAll('[role="tabpanel"]')];
  const stage = showcase.querySelector('.product-stage');
  const title = showcase.querySelector('[data-view-title]');
  const description = showcase.querySelector('[data-view-description]');
  const dialog = document.querySelector('#product-detail');
  const dialogImage = dialog.querySelector('img');
  const dialogTitle = dialog.querySelector('h2');
  const enlarge = showcase.querySelector('[data-enlarge]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 0;
  let paused =
    reduced.matches ||
    document.querySelector('#motion-toggle')?.getAttribute('aria-pressed') === 'true';
  const copy = [
    [
      'Il quadro completo, in un colpo d’occhio.',
      'Richieste, commesse e tempi: la giornata parte da una visione chiara.',
    ],
    [
      'Dal primo compito all’ultima approvazione.',
      'Attività, consegne e confronto con il cliente, nello spazio della singola commessa.',
    ],
  ];

  function select(index, focus = false) {
    selected = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === selected));
      tab.tabIndex = i === selected ? 0 : -1;
      panels[i].hidden = i !== selected;
    });
    title.textContent = copy[selected][0];
    description.textContent = copy[selected][1];
    if (focus) tabs[selected].focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : index + (event.key === 'ArrowRight' ? 1 : -1);
      select(next, true);
    });
  });

  function resetPose() {
    showcase.style.removeProperty('--device-turn');
    showcase.style.removeProperty('--device-lift');
  }
  stage.addEventListener('pointermove', (event) => {
    if (paused || reduced.matches || event.pointerType !== 'mouse') return;
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    showcase.style.setProperty('--device-turn', `${-7 + x * 7}deg`);
    showcase.style.setProperty('--device-lift', `${4 - y * 4}deg`);
  });
  stage.addEventListener('pointerleave', resetPose);
  document.addEventListener('punto:motion', ({ detail }) => {
    paused = detail.paused;
    showcase.classList.toggle('motion-paused', paused);
    resetPose();
  });
  reduced.addEventListener('change', () => {
    paused = reduced.matches;
    showcase.classList.toggle('motion-paused', paused);
    resetPose();
  });
  showcase.classList.toggle('motion-paused', paused);

  enlarge.addEventListener('click', () => {
    const current = panels[selected].querySelector('img');
    dialogImage.src = current.src;
    dialogImage.alt = current.alt;
    dialogTitle.textContent = `Punto / ${tabs[selected].textContent.trim()}`;
    dialog.showModal();
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  dialog.addEventListener('close', () => enlarge.focus());
})();
