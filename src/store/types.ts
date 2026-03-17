export type ToolMode = 'select' | 'text' | 'connect'
export type Theme = 'dark' | 'light' | 'system'

export interface ViewportState {
  panX: number
  panY: number
  zoom: number
  rotation: number // radians
}

export type ElementId = string

export interface BaseElement {
  id: ElementId
  x: number // world coords
  y: number // world coords
  width: number
  height: number
  label?: string
  color?: string // accent color: affects glow on boxes, tint on icons/text
}

export interface IconElement extends BaseElement {
  type: 'icon'
  iconName: string
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
  fontSize: number
}

export interface BoxElement extends BaseElement {
  type: 'box'
  text: string
  fontSize: number
}

export type DiagramElement = IconElement | TextElement | BoxElement

export type ConnectionStyle = 'solid' | 'dashed' | 'animated'

export interface ConnectionElement {
  id: ElementId
  type: 'connection'
  fromId: ElementId
  toId: ElementId
  label?: string
  color?: string
  style?: ConnectionStyle
}

export interface Diagram {
  id: string
  name: string
  elements: DiagramElement[]
  connections: ConnectionElement[]
  viewport: ViewportState
}

export interface IconSearchResult {
  iconName: string
  label: string
}
