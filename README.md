# UAV Forecast Taiwan

無人機飛行天氣預報 Web App。輸入地點，即時評估當前與未來 48 小時的飛行條件。

## 功能

- **飛行評分** — 綜合風速、能見度、降雨、溫度、地磁活動給出整體安全評估
- **時間軸** — 拖拉預覽未來 48 小時逐時天氣與飛行條件
- **機型設定** — 支援多款 DJI 機型及自訂規格，根據機型限制調整評分
- **高度風速** — 依飛行高度（AGL）推算高空風速
- **地磁 / Kp 指數** — 即時地磁活動與 GPS 精度影響評估（資料來源：NOAA SWPC）
- **空域圖層** — 疊加台灣 CAA 飛航管制區與國家公園範圍
- **RWD** — 支援桌面與手機版面

## 技術棧

- React + TypeScript + Vite
- Tailwind CSS + Recharts + React-Leaflet
- 天氣資料：[Open-Meteo](https://open-meteo.com/)
- 地磁資料：[NOAA SWPC](https://www.swpc.noaa.gov/)
- 空域資料：民航局 CAA FeatureServer

