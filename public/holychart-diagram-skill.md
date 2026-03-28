---
  name: holy-chart
  description: This skill allows you to create software architecture diagrams via holychart. Users will be able to open the charts at holychart.com
---

# HolyChart Diagram Authoring Guide

Use this skill when creating or modifying HolyChart diagrams programmatically — generating `.holychart.json` files or constructing diagram data structures for the ai-diagrammer app.

## File Formats

### Single diagram: `{name}.holychart.json`

```json
{
  "id": "unique-id-string",
  "name": "Diagram Name",
  "elements": [],
  "connections": [],
  "viewport": { "panX": 0, "panY": 0, "zoom": 1, "rotation": 0 }
}
```

### Workspace (multiple diagrams): `workspace.holychart.workplace.json`

```json
{
  "version": 1,
  "diagrams": [ /* array of Diagram objects */ ],
  "activeDiagramId": "id-of-active-diagram"
}
```

## Element Types

### 1. Icon Element

Displays an SVG icon from the Material Design Icons (MDI) collection.

```json
{
  "id": "icon-1",
  "type": "icon",
  "iconName": "mdi:server",
  "x": 100,
  "y": 200,
  "width": 48,
  "height": 48,
  "label": "Web Server",
  "color": "#4fc3f7"
}
```

- `iconName`: Must use `mdi:icon-name` format (see available icons below)
- `label` (optional): Text shown below the icon
- `color` (optional): Hex color for tinting the icon
- Recommended default size: `48x48` for standard icons, `64x64` for prominent ones

### 2. Text Element

Rich text with markdown support.

```json
{
  "id": "text-1",
  "type": "text",
  "text": "**Title**\nDescription here",
  "x": 300,
  "y": 100,
  "width": 200,
  "height": 40,
  "fontSize": 16,
  "color": "#ffffff"
}
```

- `text`: Supports `**bold**`, `*italic*`, `***bold+italic***`, and `\n` line breaks
- `fontSize`: Number in pixels (common values: 12, 14, 16, 20, 24, 32)
- `color` (optional): Hex color for text tint
- Width/height auto-adjust to content in the UI, but set reasonable initial values

### 3. Box Element

Container/shape with optional text label.

```json
{
  "id": "box-1",
  "type": "box",
  "text": "**API Layer**",
  "x": 50,
  "y": 50,
  "width": 300,
  "height": 400,
  "fontSize": 14,
  "style": "dashed",
  "color": "#81c784"
}
```

- `style`: `"solid"` (default), `"dashed"`, or `"filled"`
- `text`: Label with markdown support, displayed at top of box
- `color` (optional): Affects glow/border color; for `"filled"` style, fills the background
- Use boxes as grouping containers — make them large enough to visually contain child elements

## Connections

Directed arrows between elements.

```json
{
  "id": "conn-1",
  "type": "connection",
  "fromId": "icon-1",
  "toId": "icon-2",
  "label": "HTTP/REST",
  "color": "#ffb74d",
  "style": "solid"
}
```

- `fromId` / `toId`: Must reference valid element IDs
- `style`: `"solid"` (default), `"dashed"`, or `"animated"` (animated dashed line)
- `label` (optional): Text shown on the connection line, supports markdown
- `color` (optional): Hex color for the arrow/line

## Available Icons

Use the `mdi:icon-name` format. Common icons by category:

### Infrastructure
| Keyword | Icon Name |
|---------|-----------|
| server | `mdi:server` |
| servers | `mdi:server-network` |
| database / db / mysql | `mdi:database` |
| cloud | `mdi:cloud` |
| storage | `mdi:harddisk` |
| network | `mdi:lan` |
| router | `mdi:router` |
| firewall | `mdi:shield-lock` |
| load balancer | `mdi:scale-balance` |
| cdn / globe / internet | `mdi:earth` |
| dns | `mdi:dns` |
| api / rest | `mdi:api` |
| gateway | `mdi:gate` |
| vpn | `mdi:vpn` |
| kubernetes / k8s | `mdi:kubernetes` |
| docker | `mdi:docker` |
| container | `mdi:package-variant` |
| serverless / function | `mdi:function-variant` |
| lambda | `mdi:lambda` |
| queue | `mdi:tray-full` |
| cache / redis | `mdi:cached` |
| kafka / etl | `mdi:transfer` |

### Clients & Devices
| Keyword | Icon Name |
|---------|-----------|
| client / laptop | `mdi:laptop` |
| browser / web | `mdi:web` |
| mobile | `mdi:cellphone` |
| phone | `mdi:phone` |
| tablet | `mdi:tablet` |
| desktop | `mdi:desktop-classic` |
| iot | `mdi:chip` |
| device | `mdi:devices` |

### Code & Dev
| Keyword | Icon Name |
|---------|-----------|
| code | `mdi:code-tags` |
| git | `mdi:git` |
| github | `mdi:github` |
| ci | `mdi:source-pull` |
| pipeline | `mdi:pipe` |
| deploy | `mdi:rocket-launch` |
| build | `mdi:hammer-wrench` |
| test | `mdi:test-tube` |
| debug | `mdi:bug` |
| monitoring | `mdi:monitor-eye` |
| alert | `mdi:bell-alert` |
| metrics | `mdi:chart-bar` |

### Security
| Keyword | Icon Name |
|---------|-----------|
| security | `mdi:security` |
| lock / https | `mdi:lock` |
| key | `mdi:key` |
| auth | `mdi:shield-key` |
| certificate | `mdi:certificate` |
| vault | `mdi:safe-square` |

### Databases
| Keyword | Icon Name |
|---------|-----------|
| postgresql / postgres | `mdi:elephant` |
| mongodb / mongo | `mdi:leaf` |
| graphql | `mdi:graphql` |

### Languages & Frameworks
| Keyword | Icon Name |
|---------|-----------|
| node | `mdi:nodejs` |
| python | `mdi:language-python` |
| javascript | `mdi:language-javascript` |
| typescript | `mdi:language-typescript` |
| rust | `mdi:language-rust` |
| go | `mdi:language-go` |
| java | `mdi:language-java` |
| react | `mdi:react` |
| vue | `mdi:vuejs` |
| angular | `mdi:angular` |

### Communication & Data
| Keyword | Icon Name |
|---------|-----------|
| email | `mdi:email` |
| message | `mdi:message` |
| chat | `mdi:chat` |
| webhook | `mdi:webhook` |
| notification | `mdi:bell` |
| analytics | `mdi:chart-bar` |
| dashboard | `mdi:view-dashboard` |
| ai / ml | `mdi:brain` |
| user | `mdi:account` |
| users | `mdi:account-group` |

### General
| Keyword | Icon Name |
|---------|-----------|
| settings | `mdi:cog` |
| file | `mdi:file` |
| folder | `mdi:folder` |
| terminal / ssh | `mdi:console` |
| warning | `mdi:alert` |
| error | `mdi:alert-circle` |
| success | `mdi:check-circle` |
| trash | `mdi:trash-can` |

## Layout Guidelines

- **Coordinate system**: Origin (0,0) is the center of the canvas. Positive X is right, positive Y is down.
- **Spacing**: Keep at least 100px between icon centers for readability. Use 150-200px for cleaner layouts.
- **Grid alignment**: Align elements to a conceptual grid (e.g., multiples of 50px) for clean diagrams.
- **Flow direction**: Left-to-right or top-to-bottom is most readable.
- **Grouping**: Use `box` elements (style `"dashed"` or `"filled"`) to visually group related icons. Place the box behind icons by making it large enough and positioning it so the icons fall within its bounds.
- **Labels**: Use icon `label` for short names. Use separate `text` elements for longer descriptions or titles.
- **IDs**: Use descriptive, unique IDs like `"web-server"`, `"db-primary"`, `"conn-api-to-db"`.

## Example: Three-Tier Architecture

```json
{
  "id": "three-tier",
  "name": "Three-Tier Architecture",
  "elements": [
    {
      "id": "client",
      "type": "icon",
      "iconName": "mdi:laptop",
      "x": 0,
      "y": -200,
      "width": 48,
      "height": 48,
      "label": "Client"
    },
    {
      "id": "lb",
      "type": "icon",
      "iconName": "mdi:scale-balance",
      "x": 0,
      "y": -50,
      "width": 48,
      "height": 48,
      "label": "Load Balancer"
    },
    {
      "id": "api-box",
      "type": "box",
      "text": "**API Layer**",
      "x": -175,
      "y": 50,
      "width": 350,
      "height": 120,
      "fontSize": 14,
      "style": "dashed",
      "color": "#4fc3f7"
    },
    {
      "id": "api-1",
      "type": "icon",
      "iconName": "mdi:server",
      "x": -100,
      "y": 100,
      "width": 48,
      "height": 48,
      "label": "API Server 1"
    },
    {
      "id": "api-2",
      "type": "icon",
      "iconName": "mdi:server",
      "x": 100,
      "y": 100,
      "width": 48,
      "height": 48,
      "label": "API Server 2"
    },
    {
      "id": "cache",
      "type": "icon",
      "iconName": "mdi:cached",
      "x": -100,
      "y": 280,
      "width": 48,
      "height": 48,
      "label": "Redis Cache",
      "color": "#ef5350"
    },
    {
      "id": "db",
      "type": "icon",
      "iconName": "mdi:database",
      "x": 100,
      "y": 280,
      "width": 48,
      "height": 48,
      "label": "PostgreSQL",
      "color": "#81c784"
    }
  ],
  "connections": [
    {
      "id": "conn-client-lb",
      "type": "connection",
      "fromId": "client",
      "toId": "lb",
      "label": "HTTPS",
      "style": "solid"
    },
    {
      "id": "conn-lb-api1",
      "type": "connection",
      "fromId": "lb",
      "toId": "api-1",
      "style": "solid"
    },
    {
      "id": "conn-lb-api2",
      "type": "connection",
      "fromId": "lb",
      "toId": "api-2",
      "style": "solid"
    },
    {
      "id": "conn-api1-cache",
      "type": "connection",
      "fromId": "api-1",
      "toId": "cache",
      "label": "Read/Write",
      "style": "dashed"
    },
    {
      "id": "conn-api2-db",
      "type": "connection",
      "fromId": "api-2",
      "toId": "db",
      "label": "SQL",
      "style": "solid"
    },
    {
      "id": "conn-api1-db",
      "type": "connection",
      "fromId": "api-1",
      "toId": "db",
      "style": "dashed"
    }
  ],
  "viewport": { "panX": 0, "panY": 0, "zoom": 1, "rotation": 0 }
}
```

## Common Patterns

### Hub-and-Spoke
Place a central element (e.g., API gateway) at center, with services radiating outward at equal angles.

### Pipeline / Flow
Arrange elements in a line (horizontal or vertical) with sequential connections.

### Layered Architecture
Stack rows of elements vertically: clients at top, load balancers, app servers, databases at bottom. Use dashed boxes to group each layer.

### Microservices
Use a grid layout with each service as an icon. Group related services in dashed boxes. Connect with labeled arrows showing protocols (gRPC, REST, events).

## Tips

- Use `"animated"` connection style for data flow or real-time streams
- Use `"dashed"` connection style for optional or async communication
- Use `"filled"` box style with a subtle color for highlighted/important groups
- Keep viewport at `{ "panX": 0, "panY": 0, "zoom": 1, "rotation": 0 }` for default centering
- Generate unique IDs — use descriptive slugs like `"auth-service"` not numeric IDs
- The app renders on HTML5 Canvas, so elements are positioned in world coordinates (not pixel-perfect CSS)
