// Retargeting changes only the destination. Position and velocity carry through.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function spring(initial, paint, stiffness = 520, damping = 38, tolerance = 0.001) {
  let value = initial, target = initial, velocity = 0, frame = 0, previous = 0;
  let onRest;
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function finish() {
    stop();
    value = target;
    velocity = 0;
    paint(value);
    const callback = onRest;
    onRest = undefined;
    callback?.();
  }
  function step(now) {
    // Small integration steps keep the spring stable on low-refresh screens.
    let remaining = Math.min((now - previous) / 1000, 0.064);
    previous = now;
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      velocity += (stiffness * (target - value) - damping * velocity) * dt;
      value += velocity * dt;
      remaining -= dt;
    }
    if (reducedMotion.matches ||
        (Math.abs(target - value) < tolerance && Math.abs(velocity) < tolerance * 12)) {
      finish();
      return;
    }
    paint(value);
    frame = requestAnimationFrame(step);
  }
  return {
    get value() { return value; },
    move(next, speed = 0) {
      stop();
      onRest = undefined;
      value = next;
      velocity = speed;
      paint(value);
    },
    shift(delta) { value += delta; paint(value); },
    to(next, callback) {
      target = next;
      onRest = callback;
      if (reducedMotion.matches || (value === target && velocity === 0)) return finish();
      if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(step);
      }
    }
  };
}

function setupPressMotion() {
  const springs = new WeakMap();
  let pressed;
  function release() {
    if (pressed) springs.get(pressed).to(1);
    pressed = null;
  }
  function press(event) {
    const control = event.target.closest('button, summary, a');
    if (!control || control.disabled || reducedMotion.matches) return;
    release();
    if (!springs.has(control)) {
      springs.set(control, spring(1, value => { control.style.scale = String(value); }, 950, 39, 0.0003));
    }
    pressed = control;
    springs.get(control).to(0.965);
  }
  document.addEventListener('pointerdown', event => { if (event.button === 0) press(event); });
  document.addEventListener('keydown', event => {
    if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) press(event);
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keyup', release);
  window.addEventListener('blur', release);
}

function setupObjectDisclosures(gallery) {
  const moving = [...gallery.children, document.querySelector('footer')];
  const springs = moving.map(node => spring(0, offset => {
    node.style.translate = offset ? '0 ' + offset + 'px' : '';
  }, 520, 40, 0.1));

  gallery.addEventListener('click', event => {
    const summary = event.target.closest('summary');
    if (!summary || reducedMotion.matches) return;
    event.preventDefault();
    const before = moving.map(node => node.getBoundingClientRect().top);
    summary.parentElement.open = !summary.parentElement.open;
    const after = moving.map(node => node.getBoundingClientRect().top);
    moving.forEach((node, i) => {
      const delta = before[i] - after[i];
      if (!delta) return;
      springs[i].shift(delta);
      springs[i].to(0);
    });
  });
}

function createDrawer(panel) {
  let width, drag;
  const position = spring(1, value => {
    const fraction = Math.max(0, Math.min(value, 1));
    panel.style.transform = 'translateX(' + (fraction * 100) + '%)';
    panel.style.setProperty('--scrim', String(1 - fraction));
  }, 530, 44);
  function close() {
    drag = undefined;
    position.to(1, () => { if (panel.open) panel.close(); });
  }
  panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
  panel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button, input, select, label, a') ||
        event.clientX < panel.getBoundingClientRect().left) return;
    width = panel.offsetWidth;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, lastX:event.clientX,
      lastTime:event.timeStamp, speed:0, origin:position.value, active:false};
  });
  panel.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const delta = event.clientX - drag.x;
    if (!drag.active) {
      if (Math.abs(event.clientY - drag.y) > 8) { drag = undefined; return; }
      if (Math.abs(delta) < 7) return;
      drag.origin = position.value;
      drag.active = true;
      panel.setPointerCapture(event.pointerId);
    }
    drag.speed = Math.max(-4, Math.min(4, 1000 * (event.clientX - drag.lastX) /
      (Math.max(1, event.timeStamp - drag.lastTime) * width)));
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    position.move(Math.max(0, Math.min(1, drag.origin + delta / width)), drag.speed);
  });
  function release(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const gesture = drag;
    drag = undefined;
    if (!gesture.active) return;
    const speed = event.timeStamp - gesture.lastTime < 100 ? gesture.speed : 0;
    position.move(position.value, speed);
    if (event.type === 'pointerup' && position.value + speed * 0.14 > 0.4) close();
    else position.to(0);
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  return {
    open() {
      if (!panel.open) { position.move(1); panel.showModal(); }
      position.to(0);
    },
    close
  };
}
