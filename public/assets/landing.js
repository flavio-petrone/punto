'use strict';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let presentationContext;
function animatePresentation() {
  presentationContext?.revert();
  if (!window.gsap || !window.ScrollTrigger || reduceMotion.matches) return;
  gsap.registerPlugin(ScrollTrigger);
  presentationContext = gsap.context(() => {
    gsap.from('.hero-copy > *', {
      y: 24,
      opacity: 0,
      duration: 1,
      stagger: 0.085,
      ease: 'power3.out',
    });
    gsap.from('.hero-art', { opacity: 0, y: 24, duration: 1.4, ease: 'power3.out', delay: 0.15 });
    gsap.from('.hero-journey', {
      opacity: 0,
      y: 16,
      duration: 0.8,
      delay: 0.5,
      ease: 'power3.out',
    });
    document.querySelectorAll('.section').forEach((section) => {
      gsap.from(section.querySelectorAll('h2,.method-grid article,.roles article,.faq details'), {
        y: 28,
        opacity: 0,
        duration: 0.85,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 85%', once: true },
      });
    });
    gsap.from('.product-stage', {
      rotateX: 6,
      y: 45,
      scale: 0.97,
      transformPerspective: 1500,
      ease: 'none',
      scrollTrigger: {
        trigger: '.product-stage',
        start: 'top 95%',
        end: 'top 30%',
        scrub: 0.7,
      },
    });
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      onUpdate: ({ progress }) => {
        document.dispatchEvent(new CustomEvent('punto:scroll', { detail: { progress } }));
      },
    });
  });
}
animatePresentation();
reduceMotion.addEventListener('change', animatePresentation);
document.addEventListener('punto:motion', ({ detail }) => {
  if (detail.paused) presentationContext?.revert();
  else if (!reduceMotion.matches) animatePresentation();
});
