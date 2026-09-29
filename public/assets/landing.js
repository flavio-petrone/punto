'use strict';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (window.gsap && window.ScrollTrigger && !reduceMotion.matches) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.hero-copy > *', {
    y: 25,
    opacity: 0,
    duration: 0.85,
    stagger: 0.11,
    ease: 'power3.out',
  });
  gsap.from('.hero-art', { opacity: 0, y: 35, duration: 1.2, ease: 'power3.out', delay: 0.15 });
  document
    .querySelectorAll('.section')
    .forEach((section) =>
      gsap.from(
        section.querySelectorAll(
          'h2,.method-grid article,.roles article,.faq details,.workspace-preview',
        ),
        {
          y: 35,
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 85%', once: true },
        },
      ),
    );
}
document.querySelector('.workspace-preview img').addEventListener('error', function () {
  this.hidden = true;
  this.nextElementSibling.style.display = 'block';
});
