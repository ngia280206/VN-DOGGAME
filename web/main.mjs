import { Pawtown } from './game/engine.mjs';

const get = id => document.getElementById(id);
const world = get('world');
const intro = get('intro');
const start = get('start');
const hud = get('hud');
const pauseScreen = get('pause-screen');
const resume = get('resume');
const view = get('view');
const viewLabel = get('view-label');
const lookHint = get('look-hint');
const stamina = get('stamina');
const staminaFill = get('stamina-fill');
const joystick = get('joystick');
const knob = get('stick-knob');
const sprint = get('sprint');
let game;
let stickPointer = null;
let sprintPointer = null;

function showError(message) {
  start.disabled = true;
  get('fatal-message').textContent = message;
  pauseScreen.hidden = true;
  hud.hidden = true;
  get('fatal').hidden = false;
  get('reload').focus();
}

function modeChanged(mode) {
  document.body.dataset.mode = mode;
  intro.hidden = mode !== 'intro';
  hud.hidden = mode !== 'playing';
  pauseScreen.hidden = mode !== 'paused';
  stickPointer = null;
  sprintPointer = null;
  knob.style.transform = '';
  sprint.classList.remove('active');
  if (mode === 'paused') resume.focus();
}

function changeView(camera) {
  document.body.dataset.view = camera;
  const first = camera === 'first';
  viewLabel.textContent = first ? 'Góc nhìn thứ nhất' : 'Góc nhìn thứ ba';
  view.setAttribute('aria-label', first ? 'Chuyển sang góc nhìn thứ ba' : 'Chuyển sang góc nhìn thứ nhất');
}

function play(event) {
  game?.play(event.pointerType !== 'touch' && !matchMedia('(pointer: coarse)').matches);
}

start.addEventListener('click', play);
resume.addEventListener('click', play);
get('reset').addEventListener('click', event => { game.reset(); play(event); });
get('pause').addEventListener('click', () => game.pause());
get('view').addEventListener('click', () => { game.toggleView(); world.focus({ preventScroll: true }); });
get('bark').addEventListener('click', () => game.bark());
get('jump').addEventListener('pointerdown', event => {
  if (event.button === 0) game.jump();
});
get('jump').addEventListener('click', event => {
  if (event.detail === 0) game.jump();
});
get('reload').addEventListener('click', () => location.reload());

function moveStick(event) {
  if (stickPointer === null || event.pointerId !== stickPointer.id) return;
  const { x, y, range } = stickPointer;
  const dx = event.clientX - x;
  const dy = event.clientY - y;
  const divisor = Math.max(range, Math.hypot(dx, dy));
  game.stick.x = dx / divisor;
  game.stick.z = -dy / divisor;
  knob.style.transform = `translate(${dx / divisor * range}px, ${dy / divisor * range}px)`;
}

joystick.addEventListener('pointerdown', event => {
  if (event.button !== 0 || stickPointer || game.mode !== 'playing') return;
  const { left, top, width, height } = joystick.getBoundingClientRect();
  stickPointer = { id: event.pointerId, x: left + width / 2, y: top + height / 2, range: width * 0.31 };
  joystick.setPointerCapture(event.pointerId);
  moveStick(event);
});
joystick.addEventListener('pointermove', moveStick);
sprint.addEventListener('pointerdown', event => {
  if (event.button !== 0 || sprintPointer !== null || game.mode !== 'playing') return;
  sprintPointer = event.pointerId;
  sprint.setPointerCapture(event.pointerId);
  sprint.classList.add('active');
  game.touchSprint = true;
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  joystick.addEventListener(type, event => {
    if (event.pointerId !== stickPointer?.id) return;
    stickPointer = null;
    game.stick.x = 0;
    game.stick.z = 0;
    knob.style.transform = '';
  });
  sprint.addEventListener(type, event => {
    if (event.pointerId !== sprintPointer) return;
    sprintPointer = null;
    game.touchSprint = false;
    sprint.classList.remove('active');
  });
}

async function boot() {
  try {
    game = new Pawtown(world, {
      mode: modeChanged,
      view: changeView,
      error: showError,
      capture(locked) { lookHint.textContent = locked ? 'Di chuột để nhìn' : 'Kéo chuột để nhìn'; },
      stamina(percent) {
        stamina.setAttribute('aria-valuenow', percent);
        staminaFill.style.transform = `scaleX(${percent / 100})`;
      },
    });
  } catch (error) {
    console.error(error);
    showError('Trình duyệt cần WebGL 2 để hiển thị sân chơi.');
    return;
  }
  try {
    const response = await fetch('/catalog.json');
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const { dogs } = await response.json();
    await game.load(dogs[0]);
    get('start-label').textContent = 'Vào sân';
    start.disabled = false;
  } catch (error) {
    console.error(error);
    showError('Tải mẫu chó thất bại. Hãy tải lại trang để thử lại.');
  }
}

boot();
