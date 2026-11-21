import { Pawtown } from './game/engine.mjs';
import { ROSTER, initialDog, portrait, recall, remember } from './roster.mjs';

const $ = id => document.getElementById(id);
let game, dogs = [], selected, storage, toastTimer, lastHUD = 0;
try { storage = window.localStorage; } catch { /* Selection works without storage. */ }

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200);
}

function modeChanged(mode) {
  document.body.dataset.mode = mode;
  $('choose-title').hidden = mode !== 'choose'; $('picker').hidden = mode !== 'choose';
  $('hud').hidden = mode === 'choose'; $('pause-screen').hidden = mode !== 'paused';
  $('joystick').classList.remove('active'); $('stick-knob').style.transform = '';
  if (mode === 'paused') $('resume').focus();
}

function chooseDog(dog) {
  selected = dog;
  remember(storage, dog.id);
  const url = new URL(location.href); url.searchParams.set('dog', dog.id); history.replaceState(null, '', url);
  $('selected-name').textContent = dog.name;
  $('selected-tag').textContent = dog.tag;
  $('selected-description').textContent = dog.description;
  $('player-name').textContent = dog.name;
  $('player-portrait').innerHTML = portrait(dog);
  $('model-error').hidden = true;
  for (const button of $('roster').children) button.setAttribute('aria-pressed', String(button.dataset.id === dog.id));
  game.select(dog);
}

function drawMap(state, world) {
  const canvas = $('minimap'), context = canvas.getContext('2d');
  const size = canvas.width, center = size / 2, scale = size / 98;
  const x = value => center + value * scale, z = value => center + value * scale;
  context.clearRect(0, 0, size, size);
  context.save(); context.beginPath(); context.arc(center, center, center - 4, 0, Math.PI * 2); context.clip();
  context.fillStyle = '#90a47d'; context.fillRect(0, 0, size, size);
  context.fillStyle = '#dbc9a9'; context.fillRect(x(-6), 0, 12 * scale, size); context.fillRect(0, z(-4), size, 8 * scale);
  context.beginPath(); context.arc(x(0), z(-3), 11 * scale, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#8eb9b3'; context.beginPath(); context.ellipse(x(-26), z(5), 9 * scale, 12 * scale, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#719a9f'; context.beginPath(); context.arc(x(0), z(-4), 3.4 * scale, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#b88c72';
  for (const house of world.buildingFootprints) context.fillRect(x(house.x - house.width / 2), z(house.z - house.depth / 2), house.width * scale, house.depth * scale);
  for (const resident of state.residents) {
    context.fillStyle = resident.greeted ? '#f4d383' : '#f8f1df'; context.beginPath(); context.arc(x(resident.x), z(resident.z), 3, 0, Math.PI * 2); context.fill();
  }
  context.translate(x(state.x), z(state.z)); context.rotate(Math.PI - state.heading);
  context.fillStyle = '#fff4d1'; context.strokeStyle = '#3e654d'; context.lineWidth = 2;
  context.beginPath(); context.moveTo(0, -8); context.lineTo(-5.5, 5); context.lineTo(0, 2); context.lineTo(5.5, 5); context.closePath(); context.fill(); context.stroke();
  context.restore();
}

function renderHUD(state, world) {
  if (performance.now() - lastHUD < 90) return;
  lastHUD = performance.now();
  $('stamina-fill').style.transform = `scaleX(${state.stamina})`;
  $('stamina-track').setAttribute('aria-valuenow', Math.round(state.stamina * 100));
  $('treat-count').textContent = state.treats;
  $('quest-count').textContent = `${Math.min(3, state.friends)}/3`;
  $('quest-title').textContent = state.friends >= 3 ? 'Khu phố đã quen với bạn!' : 'Làm quen với 3 cư dân';
  document.querySelector('.quest').classList.toggle('complete', state.friends >= 3);
  $('interact').disabled = !state.near;
  $('interact-label').textContent = state.near ? `Chào ${state.near}` : 'Chào hỏi';
  $('near-prompt').hidden = !state.near || state.talking;
  $('near-label').textContent = state.near ? `Làm quen với ${state.near}` : '';
  if (!state.talking) $('dialogue').hidden = true;
  drawMap(state, world);
}

function play() {
  if ($('start').disabled) return;
  game.setMode('playing'); $('start').blur(); $('world').focus({ preventScroll: true });
}
$('start').addEventListener('click', play);
$('pause').addEventListener('click', () => game?.setMode('paused'));
$('resume').addEventListener('click', () => { game?.setMode('playing'); $('world').focus({ preventScroll: true }); });
$('change-dog').addEventListener('click', () => game?.setMode('choose'));
$('bark').addEventListener('click', () => game?.bark());
$('jump').addEventListener('click', () => game?.jump());
$('interact').addEventListener('click', () => game?.interact());
window.addEventListener('keydown', event => {
  if (game?.mode !== 'choose' || event.repeat) return;
  if (event.code === 'Enter') { event.preventDefault(); play(); }
  if (/^Digit\d$/.test(event.code)) {
    const index = (Number(event.code.slice(-1)) + 9) % 10;
    if (dogs[index]) chooseDog(dogs[index]);
  }
});

let stickPointer = null;
function moveStick(event) {
  if (event.pointerId !== stickPointer || !game) return;
  const bounds = $('joystick').getBoundingClientRect();
  const dx = event.clientX - bounds.left - bounds.width / 2;
  const dy = event.clientY - bounds.top - bounds.height / 2;
  const length = Math.hypot(dx, dy), factor = Math.min(1, 34 / Math.max(1, length));
  $('stick-knob').style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
  game.stick = { x: dx * factor / 34, z: -dy * factor / 34 };
}
$('joystick').addEventListener('pointerdown', event => {
  stickPointer = event.pointerId; $('joystick').setPointerCapture(event.pointerId);
  $('joystick').classList.add('active'); moveStick(event);
});
$('joystick').addEventListener('pointermove', moveStick);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(type, () => {
  stickPointer = null; if (game) game.stick = { x: 0, z: 0 };
  $('stick-knob').style.transform = ''; $('joystick').classList.remove('active');
});
$('touch-sprint').addEventListener('pointerdown', event => {
  if (game) game.touchSprint = true; $('touch-sprint').setPointerCapture(event.pointerId);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('touch-sprint').addEventListener(type, () => { if (game) game.touchSprint = false; });

try {
  const response = await fetch('/catalog.json');
  if (!response.ok) throw new Error('Không tải được danh sách nhân vật. Kiểm tra kết nối và thử lại nhé.');
  const catalog = await response.json();
  dogs = ROSTER.map(character => {
    const asset = catalog.dogs.find(dog => dog.id === character.id);
    if (!asset) throw new Error(`Thiếu nhân vật ${character.name}.`);
    return { ...asset, ...character };
  });
  game = new Pawtown($('world'), {
    mode: modeChanged, frame: renderHUD, toast,
    loading(loading) {
      $('start').disabled = loading;
      $('start-label').textContent = loading ? 'Đang gọi bạn chó…' : 'Vào khu phố';
      $('picker').classList.toggle('loading', loading);
    },
    error(message) {
      $('model-error').textContent = message; $('model-error').hidden = false;
      $('start').disabled = true; $('start-label').textContent = 'Hãy chọn lại bạn chó';
    },
    dialogue(name, text) {
      $('speaker').textContent = name; $('speech').textContent = text; $('dialogue').hidden = false;
    },
  });
  for (const [index, dog] of dogs.entries()) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'dog-card';
    button.dataset.id = dog.id; button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="card-number">${index === 9 ? '0' : index + 1}</span>${portrait(dog)}<strong></strong><span class="selection-dot"></span>`;
    button.querySelector('strong').textContent = dog.name;
    button.addEventListener('click', () => chooseDog(dog)); $('roster').append(button);
  }
  chooseDog(initialDog(dogs, new URL(location.href).searchParams.get('dog'), recall(storage)));
  game.addAmbientDogs(dogs);
  if (new URL(location.href).searchParams.has('debug')) {
    window.__pawtown = Object.freeze({ snapshot: () => game.snapshot(), renderer: () => game.renderer.info.render });
  }
} catch (error) {
  console.error(error); $('fatal-message').textContent = error.message || 'Trình duyệt chưa sẵn sàng cho đồ họa 3D. Hãy bật tăng tốc đồ họa và tải lại.';
  $('fatal').hidden = false;
}
