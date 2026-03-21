declare module 'pbf' {
  class Pbf {
    constructor(buf?: Uint8Array | Buffer | ArrayBuffer)
  }
  export = Pbf
}

declare module 'vector-tile' {
  import type { Feature } from 'geojson'

  class VectorTileFeature {
    properties: Record<string, unknown>
    type: number
    extent: number
    loadGeometry(): Array<Array<{ x: number; y: number }>>
    toGeoJSON(x: number, y: number, z: number): Feature
  }

  class VectorTileLayer {
    length: number
    feature(i: number): VectorTileFeature
  }

  class VectorTile {
    constructor(pbf: unknown)
    layers: Record<string, VectorTileLayer>
  }

  export { VectorTile, VectorTileFeature, VectorTileLayer }
}
