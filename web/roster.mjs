// These are game tuning values and personalities, rather than breed standards.
export const ROSTER = [
  { id: 'phu_quoc', name: 'Phú Quốc', tag: 'Nhanh chân', description: 'Chạy qua khoảng trống, né vòng đỏ và giữ một đường lui về mái hiên.', color: '#bb8556', ears: 'up', speed: 4.4, stamina: 1.05 },
  { id: 'hmong_bobtail', name: 'H’Mông cộc', tag: 'Bền bỉ', description: 'Giữ nhịp đi bộ khi còn kín đáo. Dành sức cho lúc bị phát hiện.', color: '#57514c', ears: 'up', speed: 3.9, stamina: 1.2 },
  { id: 'corgi', name: 'Corgi', tag: 'Không bỏ cuộc', description: 'Bước chân ngắn giữa một thị trấn quá rộng. Ánh đèn là nơi để quay về.', color: '#c58c55', ears: 'up', speed: 3.5, stamina: 1.05 },
  { id: 'shiba', name: 'Shiba Inu', tag: 'Lặng lẽ', description: 'Đợi người gác quay lưng rồi băng qua. Không phải mọi tiếng động đều đáng đuổi theo.', color: '#ce8d4d', ears: 'up', speed: 4.1, stamina: 1.05 },
  { id: 'golden_retriever', name: 'Golden', tag: 'Giữ sức', description: 'Tìm người còn sẵn lòng giúp đỡ, nhưng đừng dừng lại giữa đường tuần tra.', color: '#d7b269', ears: 'down', speed: 4.0, stamina: 1.15 },
  { id: 'husky', name: 'Husky', tag: 'Chạy đường dài', description: 'Khi khoảng cách là tất cả, hãy biết lúc nào cần bứt tốc.', color: '#8a949a', ears: 'up', speed: 4.6, stamina: 1.2 },
  { id: 'labrador', name: 'Labrador', tag: 'Kiên trì', description: 'Một chuyến đi kiếm ăn, một lối về an toàn. Chỉ cần qua được đêm nay.', color: '#c7a46d', ears: 'down', speed: 4.0, stamina: 1.2 },
  { id: 'pug', name: 'Pug', tag: 'Chọn đường kỹ', description: 'Đừng tiêu hết năng lượng ở đầu đường. Nghỉ dưới vùng đèn xanh khi cần.', color: '#bba283', ears: 'down', speed: 3.2, stamina: 0.95 },
  { id: 'chihuahua', name: 'Chihuahua', tag: 'Cảnh giác', description: 'Nhìn động tác giơ tay, đổi hướng sớm và đừng để bị dồn vào góc.', color: '#a36b4a', ears: 'up', speed: 3.4, stamina: 0.95 },
  { id: 'bac_ha', name: 'Bắc Hà', tag: 'Vượt mưa', description: 'Mưa che tiếng chân, nhưng tiếng sủa vẫn có thể đánh thức người gác.', color: '#b3a094', ears: 'up', speed: 3.8, stamina: 1.15 },
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
