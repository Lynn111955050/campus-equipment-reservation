# 校園影音器材借還系統

公開網址 https://campus-gear.a0975572026.chatgpt.site

## 展示帳號

所有展示帳號的密碼皆為 DemoAV-2026。

- student、student2 為學生，可查詢、預約與取消本人預約。
- desk 為櫃台，可查看指定日期待辦、取件與驗收歸還。
- admin 為管理員，可登錄器材、維修結案與查詢異動。

資料由雲端 D1 儲存，不同裝置共用。瀏覽器 sessionStorage 僅保存登入工作階段。

## 使用

學生選擇未來 14 天內的日期，09:00 至 17:00，半小時對齊，單次 30 分鐘至 4 小時。
櫃台須在預約開始後 15 分鐘內取件，輸入實際資產標籤和學生帳號核對。
歸還填故障時會建立維修單、停止借用並取消尚可取件的後續預約。
管理員填復測紀錄結案後器材恢復開放。

## 程式檔案

dist/server/index.js 為後端 Worker。
dist/server/page.js 為前端頁面。
drizzle/0001_initial.sql 為正式雲端資料庫遷移。
migrations/0001_initial.sql 為本機測試用的相同 schema。
tests/campus-test.mjs 驗證登入、預約衝突、重送、取消權限、取件、故障歸還、連帶取消與維修結案。
以 Node.js 24 執行 node tests/campus-test.mjs。

## 與 Word 規格的差異

本版以 Cloudflare Worker 和 D1 SQLite 實作，時間重疊由資料庫觸發器驗證。Word 原案為 Express 和 PostgreSQL。
身分驗證採固定展示帳號和兩小時的伺服器工作階段。正式校園帳號匯入、bcrypt 密碼、JWT、登入限流與備份演練尚待實作。
重送會回傳成功提示，並不保存原始完整回應。
查詢列表目前有最多 50 或 100 筆上限，尚未提供完整游標分頁。
效能壓測與跨實體裝置驗收尚未執行。雲端已驗證兩個獨立瀏覽頁面可共享同一筆預約。
正式使用前應完成上述規格差異並更換展示帳號。

## 部署

.openai/hosting.json 指定 Sites 專案與 DB 綁定。
雲端發布須包含 dist/server 及 drizzle 遷移，以 Sites 的來源同步、版本儲存和部署流程發布。
此資料夾包含部署原始碼，不包含服務憑證。


## GitHub Pages

預計儲存庫為 Lynn111955050/campus-equipment-reservation。web 目錄為靜態前端，透過 .github/workflows/pages.yml 發布。儲存庫 Settings → Pages 的 Source 須設為 GitHub Actions。前端 API_BASE 連線至現有雲端 API，後端僅允許 Lynn111955050.github.io 跨來源請求。

## 圖片資產

web/assets/equipment-room.jpg 為 AI 生成的器材室情境示意。以內建 ImageGen 生成，提示為正式大學器材室，相機、無線麥克風與腳架置於借還櫃台，無人物、無文字、無商標。原圖保存在同目錄 equipment-room-original.png。圖示由 SVG 建立。

## 教室借用

學生登入後選擇教室預約，可依容量、投影設備與無障礙動線篩選，查看當日占用，填人數與用途申請。未來30天、同日08:00至22:00、每次30分鐘至4小時，每人最多3筆未結束預約，個人同時段限一間教室。開始前後15分鐘內簽到，逾開始15分鐘未簽到會在下一次教室請求時失效並釋出。使用後須按結束使用，完成後按鈕停用。管理員可新增及停用教室，停用時取消尚未使用的預約。有使用中紀錄時阻擋停用。本人可匯出行事曆。

rooms.js為教室後端，rooms.sql為追加資料庫結構。空白測試資料庫須依序執行schema.sql與rooms.sql。執行node rooms.test.mjs可驗證衝突、額度、簽到、權限、停用與失敗回復。教室示範名稱與容量是展示資料。

## 2026-11-16 教師回覆修正

新版增加 users 及歷史帳號外鍵、audit.loan_id/repair_id 外鍵，保留原有文字欄位。依序套用 drizzle/0001 至 0006。使用者登入成功後，初始化展示帳號並分批連結已知歷史資料。每次最多回填兩類各 200 筆稽核來源，未知舊資料保留原文與空外鍵。

安全與邊界測試為 tests/teacher-review.test.mjs，遷移與使用者測試為 tests/user-audit.test.mjs，衝突重新查詢測試為 tests/conflict-ui.test.mjs。負載重現使用 node tests/load-preview.mjs，測試伺服器只監聽 127.0.0.1:8812，資料只在獨立記憶體資料庫。測試後停止伺服器。實測結果保存在 tests/results/load-nov16.json。此數據涵蓋本機 HTTP 與 SQLite，雲端 D1、真人操作及實機 Safari/Android 驗收另列待執行。
