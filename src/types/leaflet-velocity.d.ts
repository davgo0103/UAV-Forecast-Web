import 'leaflet'

declare module 'leaflet' {
  interface VelocityLayerOptions {
    displayValues?: boolean
    displayOptions?: {
      velocityType?: string
      position?: string
      emptyString?: string
      showCardinal?: boolean
      speedUnit?: string
      angleConvention?: string
    }
    data: unknown[]
    maxVelocity?: number
    minVelocity?: number
    velocityScale?: number
    colorScale?: string[]
    particleAge?: number
    lineWidth?: number
    particleMultiplier?: number
    frameRate?: number
    opacity?: number
  }

  function velocityLayer(options: VelocityLayerOptions): Layer
}

declare module 'leaflet-velocity' {}
