// These are game tuning values and personalities, rather than breed standards.
export const ROSTER = [
  { id: 'phu_quoc', name: 'Phú Quốc', tag: 'Nhà thám hiểm', description: 'Chiếc mũi tò mò, luôn sẵn sàng cho một con đường mới.', color: '#bb8556', ears: 'up', speed: 4.4, stamina: 1.05 },
  { id: 'hmong_bobtail', name: 'H’Mông cộc', tag: 'Người bạn điềm tĩnh', description: 'Một chiếc đuôi nhỏ và một trái tim thật lớn.', color: '#57514c', ears: 'up', speed: 3.9, stamina: 1.2 },
  { id: 'corgi', name: 'Corgi', tag: 'Chân ngắn, vui dài', description: 'Lạch bạch khắp phố, không bỏ lỡ một cuộc vui nào.', color: '#c58c55', ears: 'up', speed: 3.5, stamina: 1.05 },
  { id: 'shiba', name: 'Shiba Inu', tag: 'Ngôi sao khu phố', description: 'Một nụ cười tinh nghịch cho mỗi người bạn mới.', color: '#ce8d4d', ears: 'up', speed: 4.1, stamina: 1.05 },
  { id: 'golden_retriever', name: 'Golden', tag: 'Ấm áp như nắng', description: 'Chỗ nào có bạn bè, chỗ đó có một chiếc đuôi đang vẫy.', color: '#d7b269', ears: 'down', speed: 4.0, stamina: 1.15 },
  { id: 'husky', name: 'Husky', tag: 'Cục năng lượng', description: 'Cả khu phố rộng lớn đang chờ một cuộc chạy vòng quanh.', color: '#8a949a', ears: 'up', speed: 4.6, stamina: 1.2 },
  { id: 'labrador', name: 'Labrador', tag: 'Bạn của mọi nhà', description: 'Bắt đầu một ngày bằng một cái chào và một vòng dạo chơi.', color: '#c7a46d', ears: 'down', speed: 4.0, stamina: 1.2 },
  { id: 'pug', name: 'Pug', tag: 'Bậc thầy thư giãn', description: 'Chạy một chút, nghỉ một chút, tận hưởng cả ngày.', color: '#bba283', ears: 'down', speed: 3.2, stamina: 0.95 },
  { id: 'chihuahua', name: 'Chihuahua', tag: 'Nhỏ mà có võ', description: 'Bước chân bé xíu, cuộc phiêu lưu thì không hề nhỏ.', color: '#a36b4a', ears: 'up', speed: 3.4, stamina: 0.95 },
  { id: 'bac_ha', name: 'Bắc Hà', tag: 'Đám mây bốn chân', description: 'Mang một chút ấm áp từ vùng cao đến quảng trường.', color: '#b3a094', ears: 'up', speed: 3.8, stamina: 1.15 },
];
export const PLAYABLE_IDS = ROSTER.map(dog => dog.id);
export const DEFAULT_DOG = 'phu_quoc';

export function initialDog(dogs, requested, remembered) {
  return [requested, remembered, DEFAULT_DOG].map(id => dogs.find(dog => dog.id === id)).find(Boolean) || dogs[0];
}
export function recall(storage) {
  try { return storage.getItem('pawtown.dog'); } catch { return null; }
}
export function remember(storage, id) {
  try { storage.setItem('pawtown.dog', id); } catch { /* Storage is optional. */ }
}

export function portrait(dog) {
  const ears = dog.ears === 'up'
    ? '<path d="M22 42 17 9 43 28M58 28 84 9 79 43" fill="currentColor"/><path d="m23 28-2-11 12 13m34 0 12-13-2 11" stroke="#e6b6a4" stroke-width="5"/>'
    : '<ellipse cx="24" cy="42" rx="13" ry="23" fill="currentColor" transform="rotate(15 24 42)"/><ellipse cx="76" cy="42" rx="13" ry="23" fill="currentColor" transform="rotate(-15 76 42)"/>';
  return `<svg viewBox="0 0 100 90" aria-hidden="true" style="color:${dog.color}">${ears}<path d="M23 40q0-20 27-20t27 20v20q-2 22-27 22T23 60Z" fill="currentColor"/><ellipse cx="50" cy="62" rx="20" ry="17" fill="#f4e3c5"/><ellipse cx="37" cy="46" rx="3.5" ry="4.5" fill="#34342f"/><ellipse cx="63" cy="46" rx="3.5" ry="4.5" fill="#34342f"/><path d="M43 57q7-5 14 0-1 8-7 8t-7-8Z" fill="#34342f"/><path d="M50 64v6m-8 0q8 9 16 0" fill="none" stroke="#6a5749" stroke-width="2.5" stroke-linecap="round"/><path d="M46 73q4 3 8 0v5q-4 5-8 0Z" fill="#df9a91"/></svg>`;
}
