const pieces = [
  ['Amphora Vessel', 'Hand-built terracotta', 'amphora', 'A rounded earthenware vessel with twin loop handles and a burnished clay surface.'],
  ['Pedestal Bowl', 'Speckled stoneware', 'bowl', 'A shallow, wheel-thrown bowl on a low foot, finished with a warm ivory glaze.'],
  ['Loop Form', 'Black stoneware', 'loop', 'An asymmetrical ring of charcoal clay, shaped around an opening that frames the light.']
];
const gallery = document.querySelector('.objects');
for (const [title, material, image, description] of pieces) {
  const article = document.createElement('article');
  article.innerHTML = `<div class="photo"><img src="/assets/${image}.webp" alt="${title} in ${material.toLowerCase()}"></div><details><summary><div><h3>${title}</h3><small>${material}</small></div><span class="plus" aria-hidden="true">+</span></summary><p>${description}</p></details>`;
  gallery.append(article);
}
const dialog = document.querySelector('dialog');
const form = document.querySelector('form');
const success = document.querySelector('#success');
const message = document.querySelector('#error');
const title = document.querySelector('#booking-title');
for (const opener of document.querySelectorAll('[data-book]')) {
  opener.addEventListener('click', () => {
    title.textContent = 'Visit the studio';
    form.hidden = false;
    success.hidden = true;
    message.textContent = '';
    form.elements.date.min = new Date().toISOString().slice(0, 10);
    dialog.showModal();
  });
}
document.querySelector('.close').onclick = document.querySelector('#done').onclick = () => dialog.close();
dialog.addEventListener('click', event => {
  if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close();
});
let availabilityCheck = 0;
async function loadTimes() {
  const check = ++availabilityCheck;
  const date = form.elements.date.value;
  const select = form.elements.time;
  select.value = '';
  if (!date) return;
  select.disabled = true;
  message.textContent = '';
  try {
    const response = await fetch('/api/viewings?date=' + encodeURIComponent(date));
    if (!response.ok) throw new Error();
    const {times} = await response.json();
    if (check !== availabilityCheck) return;
    for (const option of select.options) {
      if (option.value) option.disabled = !times.includes(option.value);
    }
    if (!times.length) message.textContent = 'All times are taken for this date. Please choose another day.';
  } catch {
    if (check === availabilityCheck) message.textContent = 'Availability could not be loaded. Please choose your date again.';
  } finally {
    if (check === availabilityCheck) select.disabled = false;
  }
}
form.elements.date.onchange = loadTimes;
form.onsubmit = async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button');
  if (!data.time) return;
  button.disabled = true;
  button.textContent = 'Booking…';
  message.textContent = '';
  try {
    const response = await fetch('/api/viewings', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if (response.status === 409) {
      await loadTimes();
      throw new Error('That time has just been taken. Please select another.');
    }
    if (!response.ok) throw new Error('Your viewing could not be booked. Please check your details and try again.');
    const day = new Intl.DateTimeFormat(undefined,{dateStyle:'long',timeZone:'UTC'}).format(new Date(data.date+'T12:00:00Z'));
    title.textContent = 'Viewing booked';
    success.querySelector('p').textContent = `Your private collection viewing is reserved for ${day} at ${data.time} UTC, ${data.name.trim()}.`;
    form.hidden = true;
    success.hidden = false;
    document.querySelector('#done').focus();
    form.reset();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.textContent = 'Book private viewing';
    button.disabled = false;
  }
};

// Move each photograph within a fixed crop as its frame crosses the viewport.
function setupScrollMotion() {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const frames = [...document.querySelectorAll('.still, .photo')];
  let pending = 0;

  function paint() {
    pending = 0;
    const height = window.innerHeight;
    const bounds = frames.map(frame => frame.getBoundingClientRect());
    for (const [index, rect] of bounds.entries()) {
      if (!rect.height || rect.bottom < 0 || rect.top > height) continue;
      const depth = index === 0 ? 24 : 16;
      const progress = (height - rect.height - 2 * rect.top) / (height + rect.height);
      const offset = Math.max(-1, Math.min(1, progress)) * depth;
      const style = frames[index].style;
      style.setProperty('--travel', offset.toFixed(2) + 'px');
      style.setProperty('--overscan', String(1 + 2 * (depth + 1) / rect.height));
    }
  }
  function requestPaint() {
    if (!pending) pending = requestAnimationFrame(paint);
  }
  function syncPreference() {
    cancelAnimationFrame(pending);
    pending = 0;
    if (preference.matches) {
      window.removeEventListener('scroll', requestPaint);
      window.removeEventListener('resize', requestPaint);
      return;
    }
    window.addEventListener('scroll', requestPaint, {passive:true});
    window.addEventListener('resize', requestPaint);
    requestPaint();
  }
  preference.addEventListener('change', syncPreference);
  syncPreference();

  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach(({target}, index) => {
        target.style.setProperty('--delay', (index * 50) + 'ms');
        target.classList.add('in-view');
        reveal.unobserve(target);
      });
    }, {threshold: 0.12});
    for (const article of gallery.children) reveal.observe(article);
  }
}
setupScrollMotion();
