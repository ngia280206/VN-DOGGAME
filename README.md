<<<<<<< HEAD
<<<<<<< HEAD
# VN-DOGGAME
||||||| (empty tree)
# 3D-Dog-Battle-Game
||||||| parent of 99f6e44 (Add static dog model viewer with Docker and Vercel builds)
# 3D-Dog-Battle-Game
=======
# Dog Motion Lab
||||||| parent of bd4b9e9 (Turn the dog viewer into a playable Pawtown social world)
# Dog Motion Lab
=======
# Pawtown — Khu phố đuôi vẫy
>>>>>>> bd4b9e9 (Turn the dog viewer into a playable Pawtown social world)

Một game 3D trên trình duyệt: chọn một trong **10 loại chó**, vào khu phố và trực
tiếp điều khiển bạn chó đó. Thế giới có quảng trường, đài phun nước, hồ, quán nhỏ,
cây xanh, chó đi dạo và **8 cư dân NPC** có thể chào hỏi.

Bản hiện tại là một thế giới mô phỏng chạy trên máy người chơi. NPC và các bạn chó
đi dạo do game điều khiển. Game chưa có kết nối nhiều người chơi trực tuyến.
Không cần database, tài khoản hay API key.

## Chơi

1. Chọn Phú Quốc, H’Mông cộc, Corgi, Shiba, Golden, Husky, Labrador, Pug,
   Chihuahua hoặc Bắc Hà.
2. Bấm **Vào khu phố** để điều khiển chính bạn chó vừa chọn.
3. Làm quen với 3 cư dân và nhặt bánh thưởng trong lúc khám phá.

| Điều khiển | Hành động |
| --- | --- |
| WASD / phím mũi tên | Di chuyển theo hướng camera |
| Shift | Giữ để chạy nhanh, tiêu hao năng lượng |
| Space | Nhảy |
| E | Chào cư dân gần nhất |
| B | Sủa; cư dân gần đó sẽ phản ứng |
| Kéo chuột | Xoay camera |
| Cuộn chuột | Zoom camera |
| Esc | Tạm dừng / tiếp tục |

Trên điện thoại có joystick và các nút chạy, nhảy, sủa, chào hỏi. Trong menu tạm
dừng có thể đổi sang chó khác. Trò chơi nhớ lựa chọn bằng localStorage nếu trình
duyệt cho phép. URL `?dog=corgi` mở màn chọn với Corgi được chọn sẵn.

## Docker

```sh
docker build -t dog-motion-lab:latest .
docker run --rm --name dog-motion-lab -p 127.0.0.1:18081:8080 dog-motion-lab:latest
```

Mở **http://localhost:18081**. Image chạy bằng user không phải root, cổng trong
container là 8080, health check là `/healthz`. Nếu container cùng tên đang chạy,
dừng nó trước bằng `docker stop dog-motion-lab`.

Nếu có Docker Compose, chạy `docker compose up --build -d`. Cấu hình Compose dùng
filesystem chỉ đọc. Trên Mac dùng Colima, chạy `colima start` nếu Docker chưa bật.

## Chạy trực tiếp

Node.js 24 LTS hoặc Node.js 22.12+:

```sh
npm ci
npm test
npm run build
npm start
```

Mở **http://localhost:18080**. Sau khi sửa `web/`, build lại rồi tải lại trang.
Biến `PORT` đổi cổng cho server chạy trực tiếp.

## Vercel

Import repository GitHub, dùng Root Directory mặc định và framework **Other**:

- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json` cung cấp cấu hình build và cache. Vercel phục vụ game tĩnh từ `dist/`;
Docker đóng gói cùng game đó để chạy local hoặc tự host. Không cần biến môi trường.

## Cấu trúc

- `web/roster.mjs`: 10 nhân vật chơi được, mô tả và thông số gameplay.
- `web/main.mjs`: màn chọn chó, HUD, joystick, bản đồ và hội thoại.
- `web/game/engine.mjs`: vòng lặp game, camera, input và hoạt ảnh chó.
- `web/game/physics.mjs`: chuyển động, va chạm, năng lượng và khoảng cách tương tác.
- `web/game/world.mjs`: môi trường 3D tạo bằng hình học, không tải cảnh từ dịch vụ ngoài.
- `web/game/residents.mjs`: cư dân, đường đi, cử chỉ và lời chào NPC.
- `web/game/assets.mjs`: tải/clone chó có skeleton và quản lý cache tài nguyên.
- `public/`: chỉ 10 model dành cho game, metadata và thông báo nguồn tài sản.
- `scripts/`: build, kiểm tra, tạo model web và các test Node.
- `server.mjs`, `Dockerfile`, `compose.yaml`, `vercel.json`: chạy và triển khai.

## Model và dữ liệu cũ

10 model web sử dụng Meshopt, hoạt ảnh đã tối ưu và texture WebP 1024px; tổng
khoảng **34 MB**, cả bản build khoảng **35 MB**. Game tải chó đang chọn và hai
chó đi dạo, thay vì tải cả bộ sưu tập. Three.js và decoder đều được phục vụ từ
chính ứng dụng.

Bộ 294 model gốc và 23 model tùy chỉnh của ứng dụng desktop vẫn giữ trên máy
trong `assets/`; `Textures/` giữ đầu vào authoring. Những đầu vào này không nằm
trong Git và không cần để build/chạy game. Các bản web không dùng được chuyển
sang `artifacts/web-model-archive/` cục bộ và không đưa vào bản triển khai.

Ứng dụng Panda3D và các công cụ authoring Python cũ được giữ lại. Chúng cần bộ
model gốc để chạy; một checkout Git mới chỉ có 10 model dùng cho game web.

Để tạo lại model web trên máy có đầu vào gốc:

```sh
npm run models:prepare
node scripts/check-web-models.mjs
npm run build
```

Thông báo nguồn và điều kiện sử dụng model được giữ trong `public/licenses/`.

## Kiểm tra

```sh
npm test
npm run build
node scripts/check-web-models.mjs
```

Các test Node kiểm tra roster 10 chó, chuyển động theo camera, tính độc lập tốc độ
khung hình, va chạm, năng lượng, khoảng cách NPC và server HTTP. Bộ kiểm tra model
giải nén cả 10 file và xác nhận skeleton 80 khớp, các clip di chuyển và dữ liệu mesh.

Trên máy authoring vẫn có thể chạy test Python cho dữ liệu gốc:

```sh
.venv/bin/python -B -m unittest discover -s tests -v
```
>>>>>>> 99f6e44 (Add static dog model viewer with Docker and Vercel builds)
