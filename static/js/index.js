'use strict';

document.addEventListener('DOMContentLoaded', function () {
  var scrollButton = document.getElementById('scroll-to-top');

  function updateScrollButton() {
    scrollButton.classList.toggle('visible', window.scrollY > 300);
  }

  scrollButton.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('scroll', updateScrollButton, { passive: true });
  updateScrollButton();

  var autoplayVideos = document.querySelectorAll('video[data-autoplay]');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    autoplayVideos.forEach(function (video) { video.pause(); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.play().catch(function () {});
      } else {
        entry.target.pause();
      }
    });
  }, { threshold: 0.35 });

  autoplayVideos.forEach(function (video) { observer.observe(video); });
});
