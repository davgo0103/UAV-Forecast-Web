// Taiwan airspace zone field types from CAA GIS (dronegis.caa.gov.tw)
// UAV_fs Layer 1 (紅區) and Layer 3 (黃區) share this schema
export interface AirspaceProperties {
  空域名稱: string | null
  限制區: string | null       // '紅區' | '黃區'
  空域顏色: string | null     // '紅' | '黃'
  主管機關名稱: string | null  // Layer 1/3 use 主管機關名稱 (not 主管機關)
}
