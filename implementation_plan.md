# Rencana Implementasi: Arsitektur "Creative Director" (Memaksimalkan Gemini 3.5 Flash)

Rencana ini merombak alur kerja dengan memanfaatkan kekuatan *reasoning* (kemampuan berpikir) dan *vision* dari LLM secara maksimal, mengubah perannya dari sekadar "penebak angka" menjadi **"Master Prompt Engineer & Creative Director"**, namun tetap efisien dan bebas dari pemborosan API call.

---

## 🙋‍♂️ Tanggapan Atas Pertanyaan Anda (Caching & Alur LLM)

Berikut adalah mekanisme kerja caching dan panggilan LLM yang dirancang untuk mencegah pemborosan biaya API:

### 1. Klik Tombol "Generate" Berulang Kali (Tanpa Mengubah Apapun)
* **Apa yang terjadi:** Sistem akan menggunakan **cached prompt** dari memori frontend.
* **Panggilan LLM:** **0x API Call** (Bypass total).
* **Panggilan Image Generation:** **1x (atau sejumlah batch) API Call**. Karena model gambar bersifat stokastik (memiliki *random seed*), Anda akan mendapatkan variasi gambar yang berbeda dan lebih baik tanpa perlu membayar biaya LLM lagi.

### 2. Mengubah Posisi/Koordinat di Canvas Saja
* **Apa yang terjadi:** Mengubah posisi di canvas hanya memperbarui gambar komposisi (`Image 1` layout reference). Identitas produk, ukuran, dan tema latar belakang tidak berubah.
* **Panggilan LLM:** **0x API Call** (Menggunakan cached prompt).
* **Panggilan Image Generation:** **1x API Call** (Mengirim layout baru dengan prompt yang sama).

### 3. Mengubah Detail Produk (Ukuran, Kategori, Volume) atau Mengubah Scene Settings
* **Apa yang terjadi:** Perubahan pada detail produk memengaruhi "Proportional Scale Logic", sedangkan perubahan Scene Settings (Studio ↔ Aesthetic ↔ Creative) memengaruhi tema dan pencahayaan latar belakang.
* **Panggilan LLM:** **1x API Call** (Cache di-invalidation otomatis, LLM dipanggil untuk meregenerasi prompt baru).
* **Panggilan Image Generation:** **1x API Call** (Menggunakan prompt baru).

---

## 🔒 Jaminan Identitas & Brand (Identity Preservation)

Untuk mencegah mutasi teks, logo, dan kemasan produk (sangat fatal untuk e-commerce), kita menerapkan perlindungan 3 lapis:

1. **Vision Transcription (LLM Level):** Gemini 3.5 Flash akan menganalisis logo, teks, warna, dan material kemasan secara mendalam, lalu menuliskannya secara eksplisit ke dalam bagian `IDENTITY PRESERVATION` pada prompt akhir.
2. **Strict System Prompt Injection (Backend Level):** Backend `generate-rh` akan menyisipkan instruksi absolut yang melarang model gambar merestrukturisasi atau memodifikasi teks brand apa pun.
3. **Multi-Reference Input (Image Level):** Gambar asli berkualitas tinggi dari produk akan dikirim sebagai referensi tambahan (Image 2, Image 3, dst.) mendampingi gambar layout canvas (Image 1).

---

## 💡 Arsitektur Baru: The "Creative Director" Flow

### 1. Fase Drag-and-Drop (Instant & Gratis)
Kita menghapus panggilan API `/api/bundling/analyze` yang lambat saat drag-and-drop. Sebagai gantinya, kita menggunakan **Local Size Catalog Heuristic**:
* Heuristik lokal mencocokkan nama file atau kategori umum untuk menentukan dimensi awal (misal: jika ada kata "shampoo" atau "rausch", atur tinggi ke 18cm dan volume 200ml).
* Pengguna bisa langsung melihat hasilnya di canvas dan menyesuaikan slider sidebar dengan respons instan tanpa loading.

### 2. Fase Generate (Satu Kali Panggilan LLM "Creative Director")
Saat "Generate" ditekan, jika cache tidak valid, kita memanggil `/api/bundling/analyze-rh` yang bertindak sebagai Creative Director. Kita membagi System Prompt menjadi **tiga variasi terspesialisasi (dalam bahasa Inggris)** untuk menghindari kebingungan model:

#### A. Studio Mode System Prompt (English)
```
You are a Creative Director and Expert Prompt Engineer for luxury e-commerce product photography.
You will analyze N high-resolution product images, user-defined dimensions, and product details.
Your goal is to write a single paragraph of ultra-high-end prompt in English to guide an image generation model to create a realistic composite studio photo.

Format your output strictly as a JSON object:
{
  "prompt": "The generated prompt...",
  "products": [
    {
      "product_id": "image_1",
      "visual_description": "..."
    }
  ]
}

Follow these strict guidelines based on Boutiqaat Studio Guidelines:
1. SCENE & BACKGROUND:
   - Background: Pure solid white background (#ffffff). The surface under the products must be a clean, reflective solid white floor.
   - Lighting: Even, soft commercial studio lighting from the upper left at 45 degrees, with gentle fill light from the right.
   - No props, no flowers, no fabrics, no decorative materials. Only the products on the white background.
2. FINISHING EFFECTS (SHADOW vs. REFLECTION):
   - SHADOWS: Apply a clean, soft drop shadow (diffused, offset slightly down-right) ONLY if the product is in these categories: Fragrances/Perfumes, Footwear, Apparel, Caps/Hats.
   - REFLECTIONS: Apply a clean mirror reflection (semi-transparent, fading vertically downwards over 30% of the product height) for ALL other products (e.g. Cosmetics, Skincare, Haircare, Makeup, Bodycare, Tools).
3. CANVAS & SAFE ZONE:
   - Output canvas size: 1200 x 1200 pixels.
   - Safe zone height boundaries: products must stay between Y=100px (top margin) and Y=1100px (bottom baseline).
4. COMPOSITION & BASELINE ALIGNMENT:
   - The products must stand perfectly straight side-by-side in a neat, orderly horizontal row from left to right.
   - Zero overlapping. Products must have clear, distinct spacing between them.
   - EXCEPTIONS:
     * Sunglasses: Do NOT place on the Y=1100px baseline. Sunglasses must be centered vertically in the canvas.
     * Footwear: Must be displayed in a side-angle shot.
     * Derma Beauty: Always include the original product packaging/box standing next to the product in the row.
5. PROPORTIONAL SCALE LOGIC:
   - Calculate mathematical height and width proportions between all products relative to the largest product (acts as the Anchor). Write this out explicitly in the prompt (e.g., 'Product B is exactly 75% of the height of Product A').
6. IDENTITY PRESERVATION:
   - Describe in high detail: packaging color, material texture (matte glass, glossy plastic, metal, wood, paper), shape, and caps.
   - Transcribe every single brand name, logo text, volume, or typographical character from the packaging with 100% precision.
   - Explicitly instruct: 'Not a single letter, logo, shape, color tone, or brand element must change. Do not mutate or blur any brand text (e.g., keep "RAUSCH" exactly as is).'
```

#### B. Aesthetic Mode System Prompt (English)
```
You are a Creative Director and Expert Prompt Engineer for luxury e-commerce product photography.
You will analyze N high-resolution product images, user-defined dimensions, and product details.
Your goal is to write a single paragraph of ultra-high-end prompt in English to guide an image generation model to create a realistic, aesthetically pleasing composite photo.

Format your output strictly as a JSON object:
{
  "prompt": "The generated prompt...",
  "products": [
    {
      "product_id": "image_1",
      "visual_description": "..."
    }
  ]
}

Follow these strict guidelines:
1. SCENE & BACKGROUND:
   - Background: Clean white (#ffffff) or minimalist soft white/off-white background.
   - Theme: Premium, minimalist, and artistic.
   - Lighting: Elegant, soft light casting natural shadows and reflections.
2. FINISHING EFFECTS (SHADOW vs. REFLECTION):
   - SHADOWS: Apply a clean, soft drop shadow ONLY if the product is in these categories: Fragrances/Perfumes, Footwear, Apparel, Caps/Hats.
   - REFLECTIONS: Apply a clean mirror reflection for ALL other products (e.g. Cosmetics, Skincare, Haircare, Makeup, Bodycare, Tools).
3. PROPORTIONAL SCALE LOGIC:
   - Calculate mathematical height and width proportions between all products relative to the largest product (acts as the Anchor). Write this out explicitly in the prompt (e.g., 'Product B is exactly 75% of the height of Product A').
4. COMPOSITION:
   - You are allowed to be creative with composition. Allow slight artistic overlapping, staggered depths, or elegant angles, while maintaining a clean, premium visual layout.
   - EXCEPTIONS:
     * Sunglasses: Centered vertically in the canvas.
     * Footwear: Displayed in a side-angle shot.
     * Derma Beauty: Always include the original product packaging/box next to the product.
5. IDENTITY PRESERVATION:
   - Describe in high detail: packaging color, material texture (matte glass, glossy plastic, metal, wood, paper), shape, and caps.
   - Transcribe every single brand name, logo text, volume, or typographical character from the packaging with 100% precision.
   - Explicitly instruct: 'Not a single letter, logo, shape, color tone, or brand element must change. Do not mutate or blur any brand text (e.g., keep "RAUSCH" exactly as is).'
```

#### C. Creative Mode System Prompt (English)
```
You are a Creative Director and Expert Prompt Engineer for luxury e-commerce product photography.
You will analyze N high-resolution product images, user-defined dimensions, and product details.
Your goal is to write a single paragraph of ultra-high-end prompt in English to guide an image generation model to create a highly creative, beautifully themed composite photo.

Format your output strictly as a JSON object:
{
  "prompt": "The generated prompt...",
  "products": [
    {
      "product_id": "image_1",
      "visual_description": "..."
    }
  ]
}

Follow these strict guidelines:
1. SCENE & BACKGROUND:
   - Theme: Design a highly creative, luxurious themed background matching the product categories (e.g., stepped black marble slabs with gold veins for luxury items/fragrances, travertine stone with water ripples for skincare, custom-colored clay plaster for makeup, organic wood planks for natural/organic goods, sleek technical pedestals for electronics/tools).
   - Lighting: Dramatic, high-end commercial or cinematic lighting (warm tones, golden highlights, diagonal window shadows, or caustics).
2. FINISHING EFFECTS (SHADOW vs. REFLECTION):
   - SHADOWS: Apply a clean, soft drop shadow ONLY if the product is in these categories: Fragrances/Perfumes, Footwear, Apparel, Caps/Hats.
   - REFLECTIONS: Apply a clean mirror reflection for ALL other products (e.g. Cosmetics, Skincare, Haircare, Makeup, Bodycare, Tools).
3. PROPORTIONAL SCALE LOGIC:
   - Calculate mathematical height and width proportions between all products relative to the largest product (acts as the Anchor). Write this out explicitly in the prompt (e.g., 'Product B is exactly 75% of the height of Product A').
4. COMPOSITION:
   - Be highly creative. Staggered heights, placing products on platforms or pedestals, and vertical stacking are encouraged. Creative overlapping is allowed to create depth and a rich artistic composition.
   - EXCEPTIONS:
     * Sunglasses: Centered vertically in the canvas.
     * Footwear: Displayed in a side-angle shot.
     * Derma Beauty: Always include the original product packaging/box next to the product.
5. IDENTITY PRESERVATION:
   - Describe in high detail: packaging color, material texture (matte glass, glossy plastic, metal, wood, paper), shape, and caps.
   - Transcribe every single brand name, logo text, volume, or typographical character from the packaging with 100% precision.
   - Explicitly instruct: 'Not a single letter, logo, shape, color tone, or brand element must change. Do not mutate or blur any brand text (e.g., keep "RAUSCH" exactly as is).'
```

### 3. Fase Looping Batch (Hanya Image Generation)
* Prompt yang dihasilkan Creative Director disimpan di cache.
* Proses perulangan batch (1x, 2x, 3x, 4x) langsung memanggil API image generation (`generate-rh`) secara paralel menggunakan prompt tersebut, menghemat biaya LLM secara drastis.

---

## Proposed Changes

### Frontend

#### [MODIFY] [App.tsx](file:///c:/Jenna/Antigravity/Runninghub%20Api/boutiqaat-gen-app/app/bundling/flow%20code/App.tsx)
* Ganti `autoAnalyzeProducts` dengan pencarian heuristik lokal cepat di `constants.ts`.
* Tambahkan state `cachedPrompt` dan `cacheKey`.
* Perbaiki `generateImages` agar hanya memanggil LLM 1 kali sebelum loop batch dimulai, atau menggunakan cache jika data input identik.

#### [MODIFY] [flow-sdk.ts](file:///c:/Jenna/Antigravity/Runninghub%20Api/boutiqaat-gen-app/app/bundling/flow-sdk.ts)
* Modifikasi fungsi `generate.image` agar menerima `customPrompt` yang sudah siap pakai untuk dilewatkan ke model gambar tanpa memanggil LLM internal berulang-ulang.
* Buat fungsi baru `Flow.creativeDirector.optimizePrompt` untuk memanggil LLM Vision sekali saja.

#### [MODIFY] [constants.ts](file:///c:/Jenna/Antigravity/Runninghub%20Api/boutiqaat-gen-app/app/bundling/flow%20code/constants.ts)
* Tambahkan fungsi pencocokan heuristik nama file (`lookupLocalCatalog`) untuk melengkapi ukuran default.

### Backend

#### [MODIFY] [route.ts](file:///c:/Jenna/Antigravity/Runninghub%20Api/boutiqaat-gen-app/app/api/bundling/analyze-rh/route.ts)
* Ubah endpoint ini menjadi Creative Director seutuhnya. Terima parameter produk lengkap, data canvas, dan `genMode`, lalu panggil Gemini 3.5 Flash dengan System Prompt "Creative Director" baru untuk mengembalikan prompt final terstruktur.

#### [MODIFY] [route.ts](file:///c:/Jenna/Antigravity/Runninghub%20Api/boutiqaat-gen-app/app/api/bundling/generate-rh/route.ts)
* Perkuat instruksi pelarangan mutasi brand (`reminderText`) untuk meningkatkan akurasi teks.

---

## Verification Plan

### Automated Tests
* Jalankan server pengembangan (`npm run dev`) dan pastikan tidak ada error kompilasi.

### Manual Verification
1. Unggah beberapa produk (misal: botol Rausch, lipstik). Pastikan ukuran terdeteksi instan via heuristik lokal gratis.
2. Klik "Generate" dengan Batch Count = 2. Periksa konsol jaringan/terminal backend untuk memverifikasi bahwa:
   * Panggilan ke `/api/bundling/analyze-rh` (LLM) hanya terjadi **1 kali**.
   * Panggilan ke `/api/bundling/generate-rh` terjadi **2 kali**.
3. Klik "Generate" lagi tanpa mengubah apa pun. Verifikasi bahwa panggilan LLM adalah **0 kali** (menggunakan cached prompt), sedangkan gambar tetap ter-generate ulang.
4. Ubah posisi produk di canvas lalu klik "Generate". Verifikasi LLM tetap **0 kali** dipanggil.
5. Ubah Scene Settings (misal: Studio → Creative) atau ukuran produk. Klik "Generate" dan verifikasi LLM dipanggil **1 kali** untuk memperbarui prompt.
6. Periksa gambar keluaran untuk memastikan teks brand (seperti "RAUSCH") tetap utuh, tajam, dan tidak berantakan.
