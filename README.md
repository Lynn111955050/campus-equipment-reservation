# 校園器材與教室預約管理系統

[公開展示網站](https://lynn111955050.github.io/campus-equipment-reservation/)

GitHub Pages 從 main 分支根目錄發布 index.html。預約資料由 Cloudflare Worker 和 D1 處理，手機與電腦共用。後端程式位於 dist/server，資料庫遷移檔位於 drizzle。

## 本機驗證

使用 Node.js 24，在 PowerShell 依序執行 tests 目錄下的 .mjs 檔案。每個腳本會建立獨立測試資料庫。故意注入交易失敗的案例可能輸出錯誤訊息，請依腳本的結束碼及通過摘要判定。

## 展示帳號

學生 student 或 student2，櫃台 desk，管理員 admin。展示密碼見規格書附錄 A.4。
