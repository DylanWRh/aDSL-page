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

  document.querySelectorAll('[data-results-carousel]').forEach(function (carousel) {
    var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-results-slide]'));
    var previousButton = carousel.querySelector('[data-results-previous]');
    var nextButton = carousel.querySelector('[data-results-next]');
    var currentIndex = 0;

    if (slides.length < 2 || !previousButton || !nextButton) return;

    var indicatorContainer = document.createElement('div');
    indicatorContainer.className = 'editing-carousel__indicators';
    indicatorContainer.setAttribute('role', 'group');
    indicatorContainer.setAttribute('aria-label', 'Select a case');

    var indicatorButtons = slides.map(function (_, index) {
      var button = document.createElement('button');
      button.className = 'editing-carousel__indicator';
      button.type = 'button';
      button.setAttribute('aria-label', 'Show case ' + (index + 1) + ' of ' + slides.length);
      button.addEventListener('click', function () {
        showSlide(index);
      });
      indicatorContainer.appendChild(button);
      return button;
    });

    carousel.appendChild(indicatorContainer);

    function showSlide(nextIndex) {
      currentIndex = (nextIndex + slides.length) % slides.length;
      slides.forEach(function (slide, index) {
        var isCurrent = index === currentIndex;
        slide.classList.toggle('is-active', isCurrent);
        slide.hidden = !isCurrent;
        slide.setAttribute('aria-hidden', String(!isCurrent));
      });
      indicatorButtons.forEach(function (button, index) {
        var isCurrent = index === currentIndex;
        button.classList.toggle('is-active', isCurrent);
        if (isCurrent) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    }

    previousButton.addEventListener('click', function () {
      showSlide(currentIndex - 1);
    });

    nextButton.addEventListener('click', function () {
      showSlide(currentIndex + 1);
    });

    showSlide(0);
  });

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
