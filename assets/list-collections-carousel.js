document.querySelectorAll('.collections-carousel__wrap').forEach(function (wrap) {
  var track = wrap.querySelector('[data-carousel-track]');
  var prev = wrap.querySelector('[data-carousel-prev]');
  var next = wrap.querySelector('[data-carousel-next]');

  prev.addEventListener('click', function () {
    track.scrollBy({ left: -220, behavior: 'smooth' });
  });

  next.addEventListener('click', function () {
    track.scrollBy({ left: 220, behavior: 'smooth' });
  });
});
