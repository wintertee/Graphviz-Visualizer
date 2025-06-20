# Graphviz DOT File Visualizer

A modern, interactive web-based visualizer for Graphviz DOT files with edge filtering and responsive design.

## Features

- 📊 **Interactive Visualization**: Upload `.dot` files or paste DOT language content directly
- 🎛️ **Edge Filtering**: Filter and toggle graph edges dynamically
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- 🔍 **Pan & Zoom**: Navigate large graphs with built-in pan and zoom controls
- 🎨 **Modern UI**: Clean, intuitive interface with CSS grid layout
- ⚡ **Client-side Processing**: No server required - runs entirely in the browser

## Quick Start

1. Clone or download this repository
2. Start a local web server:
   ```bash
   npm run serve
   # or
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser
4. Upload a `.dot` file or try the included examples

## Usage

- **Upload File**: Click the upload area or drag & drop a `.dot` file
- **Edit Code**: Use the built-in editor to modify DOT language content
- **Filter Edges**: Use the edge filter controls to show/hide specific connections
- **Navigate**: Pan and zoom the visualization as needed

## Examples

The `examples/` folder contains sample DOT files to get you started:
- `simple.dot` - Basic directed graph
- `hierarchy.dot` - Hierarchical structure example

## Technology Stack

- Vanilla JavaScript (ES6 modules)
- CSS Grid & Flexbox for layout
- [@viz-js/viz](https://github.com/mdaines/viz-js) for Graphviz rendering
- SVG for visualization output

## License

MIT License
