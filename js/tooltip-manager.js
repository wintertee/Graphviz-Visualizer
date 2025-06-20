// Custom tooltip manager for enhanced tooltip experience
export class TooltipManager {
    constructor() {
        this.currentTooltip = null;
        this.hideTimeout = null;
        this.updateTimeout = null;
        this.createTooltipContainer();
    }

    createTooltipContainer() {
        // Create tooltip container if it doesn't exist
        if (!document.getElementById('custom-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'custom-tooltip';
            tooltip.className = 'custom-tooltip';
            document.body.appendChild(tooltip);
            this.currentTooltip = tooltip;
        } else {
            this.currentTooltip = document.getElementById('custom-tooltip');
        }
    }

    showTooltip(content, x, y, type = 'default') {
        if (!this.currentTooltip) {
            this.createTooltipContainer();
        }

        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // Parse and format the content
        const formattedContent = this.formatTooltipContent(content, type);

        // Set tooltip content
        this.currentTooltip.innerHTML = formattedContent;

        // Position tooltip
        this.positionTooltip(x, y);

        // Show tooltip with animation
        this.currentTooltip.classList.add('show');
    }

    hideTooltip(delay = 300) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        this.hideTimeout = setTimeout(() => {
            if (this.currentTooltip) {
                this.currentTooltip.classList.remove('show');
            }
        }, delay);
    }

    formatTooltipContent(content, type) {
        const typeClass = type === 'node' ? 'node-tooltip' : type === 'edge' ? 'edge-tooltip' : '';
        const icon = type === 'node' ? '●' : type === 'edge' ? '→' : '●';
        const title = type === 'node' ? 'Node' : type === 'edge' ? 'Edge' : 'Element';

        // Parse DOT attributes from content
        const parsed = this.parseDOTContent(content);

        let attributesHtml = '';
        if (parsed.attributes.length > 0) {
            attributesHtml = parsed.attributes.map(attr =>
                `<div class="tooltip-attribute"><span class="tooltip-attribute-key">${attr.key}:</span><span class="tooltip-attribute-value">${attr.value}</span></div>`
            ).join('');
        } else {
            // 如果没有解析到属性，显示一个默认信息
            attributesHtml = `<div class="tooltip-attribute"><span class="tooltip-attribute-key">id:</span><span class="tooltip-attribute-value">${parsed.id}</span></div>`;
        }

        return `<div class="tooltip-content ${typeClass}"><div class="tooltip-header"><span class="tooltip-icon">${icon}</span><span>${title}</span></div><div class="tooltip-body">${attributesHtml}</div></div>`;
    } parseDOTContent(content) {
        if (!content) return { id: 'Unknown', definition: '', attributes: [] };

        // Extract node/edge ID and attributes
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) return { id: 'Unknown', definition: '', attributes: [] };

        const firstLine = lines[0];

        // Try to extract ID from the first line
        let id = 'Unknown';
        const idMatch = firstLine.match(/^([a-zA-Z0-9_]+)(?:\s*(-[->]|--)\s*([a-zA-Z0-9_]+))?\s*\[/);
        if (idMatch) {
            if (idMatch[2]) {
                // Edge definition
                id = `${idMatch[1]}${idMatch[2]}${idMatch[3]}`;
            } else {
                // Node definition
                id = idMatch[1];
            }
        }

        // Extract attributes with improved regex
        const attributes = [];
        const fullContent = lines.join(' ').replace(/\s+/g, ' ');

        // More comprehensive attribute regex that handles quoted values better
        const attributeRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\]\s]+))/g;
        let match;

        while ((match = attributeRegex.exec(fullContent)) !== null) {
            const key = match[1];
            // Get the value from whichever capture group matched
            const value = match[2] || match[3] || match[4] || '';

            // Skip empty values
            if (value.trim()) {
                attributes.push({
                    key: key,
                    value: value.trim()
                });
            }
        }

        // If no attributes found but we have content, try to extract the ID as an attribute
        if (attributes.length === 0 && id !== 'Unknown') {
            attributes.push({
                key: 'id',
                value: id
            });
        }

        return {
            id: id,
            definition: this.cleanDefinition(content),
            attributes: attributes
        };
    }

    cleanDefinition(definition) {
        // Clean up the definition for better display
        return definition
            .replace(/^\s+|\s+$/gm, '') // Trim lines
            .replace(/\s*\[\s*/, ' [') // Clean up bracket spacing
            .replace(/\s*\]\s*/, ']') // Clean up closing bracket
            .replace(/;\s*$/, ''); // Remove trailing semicolon
    }

    positionTooltip(x, y) {
        if (!this.currentTooltip) return;

        const tooltip = this.currentTooltip;

        // Force a layout calculation to get accurate dimensions
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'block';

        const rect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Hide it again until we position it
        tooltip.style.visibility = 'visible';
        tooltip.style.display = '';

        // Calculate position with better offset for mouse following
        const offset = 12; // Distance from cursor
        let left = x - rect.width / 2;
        let top = y - rect.height - offset;

        // Horizontal boundary check
        if (left < 10) {
            left = 10;
        } else if (left + rect.width > viewportWidth - 10) {
            left = viewportWidth - rect.width - 10;
        }

        // Vertical boundary check
        let isAbove = true;
        if (top < 10) {
            top = y + offset; // Show below cursor
            isAbove = false;
        }

        // Apply position
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        // Update arrow position class
        tooltip.className = `custom-tooltip show${isAbove ? ' top' : ''}`;
    }

    setupElementTooltips(element, content, type) {
        const showTooltip = (event) => {
            let x, y;

            if (type === 'edge') {
                // For edges, use mouse position since edges can be very long
                x = event.clientX;
                y = event.clientY;
            } else {
                // For nodes, use element center
                const rect = element.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top;
            }

            this.showTooltip(content, x, y, type);
        };

        const updateTooltipPosition = (event) => {
            if (type === 'edge' && this.currentTooltip && this.currentTooltip.classList.contains('show')) {
                // Throttle position updates for edges to improve performance
                if (this.updateTimeout) {
                    clearTimeout(this.updateTimeout);
                }

                this.updateTimeout = setTimeout(() => {
                    this.positionTooltip(event.clientX, event.clientY);
                }, 16); // ~60fps
            }
        };

        const hideTooltip = () => {
            if (this.updateTimeout) {
                clearTimeout(this.updateTimeout);
                this.updateTimeout = null;
            }
            this.hideTooltip();
        };

        // Mouse events
        element.addEventListener('mouseenter', showTooltip);
        if (type === 'edge') {
            element.addEventListener('mousemove', updateTooltipPosition);
        }
        element.addEventListener('mouseleave', hideTooltip);

        // Touch events for mobile
        element.addEventListener('touchstart', (event) => {
            event.preventDefault();
            let x, y;

            if (type === 'edge' && event.touches && event.touches[0]) {
                // For edges on touch, use touch position
                x = event.touches[0].clientX;
                y = event.touches[0].clientY;
            } else {
                // For nodes on touch, use element center
                const rect = element.getBoundingClientRect();
                x = rect.left + rect.width / 2;
                y = rect.top;
            }

            this.showTooltip(content, x, y, type);
        });

        element.addEventListener('touchend', hideTooltip);

        // Store cleanup function
        element._tooltipCleanup = () => {
            element.removeEventListener('mouseenter', showTooltip);
            if (type === 'edge') {
                element.removeEventListener('mousemove', updateTooltipPosition);
            }
            element.removeEventListener('mouseleave', hideTooltip);
            element.removeEventListener('touchstart', showTooltip);
            element.removeEventListener('touchend', hideTooltip);
        };
    }

    cleanup() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }
}
