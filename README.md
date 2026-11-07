# 校園器材預約

提供校內器材查詢、時段預約、個人紀錄、櫃台借還、故障停借與維修結案。

## 網站

前端以 GitHub Pages 發布，來源選擇 main 分支的根目錄。
index.html 內含版面、圖示與器材室圖片，可直接部署。
前端透過 HTTPS 呼叫既有共享雲端 API https://campus-gear.a0975572026.chatgpt.site。
資料保存在雲端資料庫，手機與電腦共用。

## 展示帳號

學生 student、student2；櫃台 desk；管理員 admin。
密碼皆為 DemoAV-2026。請使用測試資料。

預約開放未來 14 天，每日 09:00 至 17:00，以半小時為單位，單次 30 分鐘至 4 小時。
櫃台在開始後 15 分鐘內核對身分及標籤取件。
歸還驗收故障會停借、開維修單並取消受影響預約。

## 程式與驗證

backend.js 為 Cloudflare Worker 後端，page.js 為其內嵌前端，schema.sql 為 D1 SQLite schema。
以 Node.js 24 執行 node tests.mjs，驗證預約衝突、重送、授權、故障取消與維修復用。
GitHub Pages 僅發布前端。部署後端需獨立配置 Cloudflare Worker 及 D1，匯入 schema.sql 並將資料庫綁定為 DB。

## 規格差異

目前採固定展示帳號、兩小時伺服器工作階段及 D1 SQLite。正式校園身分驗證、完整分頁、登入限流、備份還原演練及效能壓測尚待完成。

## 圖像

器材室照片為內建 ImageGen 生成的情境示意，提示為正式大學器材室借還櫃台，配置相機、無線麥克風與腳架，無人物、文字或商標。equipment-room.jpg 為該圖片的網頁版。圖示以 SVG 建立。
