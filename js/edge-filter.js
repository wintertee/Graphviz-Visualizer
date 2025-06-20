// Edge filter module for filtering edges by label
export class EdgeFilter {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.edgeLabels = new Set();
        this.selectedLabels = new Set(['all']);
        this.isDropdownOpen = false;

        // Cache DOM elements for performance
        this.dropdownElements = null;
        this.cachedDotContent = '';
        this.cachedEdgeLabels = null;

        // Debounce filter application
        this.filterTimeout = null;
    }

    // Parse DOT content to extract all edge labels with caching
    parseEdgeLabels(dotContent) {
        // Use cached result if content hasn't changed
        if (dotContent === this.cachedDotContent && this.cachedEdgeLabels) {
            this.edgeLabels = new Set(this.cachedEdgeLabels);
            return Array.from(this.edgeLabels).sort();
        }

        this.edgeLabels.clear();

        try {
            // Regular expression to match edges with labels
            // Matches both -> and -- (directed and undirected graphs)
            // Captures label attributes in square brackets
            const edgeRegex = /\w+\s*(?:->|--)\s*\w+\s*\[([^\]]+)\]/g;
            const labelRegex = /label\s*=\s*["']([^"']+)["']/;

            let match;
            while ((match = edgeRegex.exec(dotContent)) !== null) {
                const attributes = match[1];
                const labelMatch = attributes.match(labelRegex);
                if (labelMatch) {
                    this.edgeLabels.add(labelMatch[1]);
                }
            }

            // Cache the results
            this.cachedDotContent = dotContent;
            this.cachedEdgeLabels = Array.from(this.edgeLabels);

        } catch (error) {
            console.error('Error parsing edge labels:', error);
            this.visualizer.showMessage('Warning: Could not parse edge labels', 'warning');
        }

        return Array.from(this.edgeLabels).sort();
    }

    // Update the edge filter dropdown with available labels
    updateFilterDropdown() {
        const dropdownContent = document.getElementById('edgeFilterContent');
        const labels = Array.from(this.edgeLabels).sort();

        // Clear existing options except "Show All"
        dropdownContent.innerHTML = `
            <div class="filter-option all-edges">
                <input type="checkbox" id="filter-all" value="all" ${this.selectedLabels.has('all') ? 'checked' : ''}>
                <label for="filter-all">Show All Edges</label>
            </div>
        `;

        // Add options for each unique edge label
        labels.forEach((label, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            optionDiv.innerHTML = `
                <input type="checkbox" id="filter-${index}" value="${label}" ${this.selectedLabels.has(label) ? 'checked' : ''}>
                <label for="filter-${index}">${label}</label>
            `;
            dropdownContent.appendChild(optionDiv);
        });

        // Add option for edges without labels
        const unlabeledDiv = document.createElement('div');
        unlabeledDiv.className = 'filter-option';
        unlabeledDiv.innerHTML = `
            <input type="checkbox" id="filter-no-label" value="__no_label__" ${this.selectedLabels.has('__no_label__') ? 'checked' : ''}>
            <label for="filter-no-label">Edges without labels</label>
        `;
        dropdownContent.appendChild(unlabeledDiv);

        // If no labels found, show appropriate message
        if (labels.length === 0) {
            const noLabelsDiv = document.createElement('div');
            noLabelsDiv.className = 'filter-option';
            noLabelsDiv.style.fontStyle = 'italic';
            noLabelsDiv.style.color = '#999';
            noLabelsDiv.innerHTML = '<span>No edge labels found</span>';
            dropdownContent.appendChild(noLabelsDiv);
        }

        this.updateDropdownLabel();
        this.setupDropdownEvents();
    }

    // Update the dropdown header label based on selection
    updateDropdownLabel() {
        const dropdownLabel = document.querySelector('.dropdown-label');
        const selectedCount = this.selectedLabels.size;

        if (this.selectedLabels.has('all')) {
            dropdownLabel.textContent = 'Show All Edges';
        } else if (selectedCount === 0) {
            dropdownLabel.textContent = 'No edges selected';
        } else if (selectedCount === 1) {
            const selectedLabel = Array.from(this.selectedLabels)[0];
            if (selectedLabel === '__no_label__') {
                dropdownLabel.textContent = 'Edges without labels';
            } else {
                dropdownLabel.textContent = selectedLabel;
            }
        } else {
            dropdownLabel.textContent = `${selectedCount} edge types selected`;
        }
    }

    // Setup event listeners for the custom dropdown
    setupDropdownEvents() {
        const dropdownContent = document.getElementById('edgeFilterContent');

        // Add click listeners to all checkboxes
        dropdownContent.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.onFilterChange(e));
        });
    }

    // Filter DOT content based on selected edge labels
    filterDotContent(dotContent, selectedLabels) {
        if (selectedLabels.has('all') || selectedLabels.size === 0) {
            return dotContent;
        }

        const lines = dotContent.split('\n');
        const filteredLines = [];

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if this line contains an edge
            if (trimmedLine.includes('->') || trimmedLine.includes('--')) {
                // Check if the edge has a label attribute
                const labelMatch = trimmedLine.match(/label\s*=\s*["']([^"']+)["']/);

                if (labelMatch) {
                    const edgeLabel = labelMatch[1];
                    // Only include this edge if its label is selected
                    if (selectedLabels.has(edgeLabel)) {
                        filteredLines.push(line);
                    }
                } else {
                    // Edge without label - include if "no label" option is selected
                    if (selectedLabels.has('__no_label__')) {
                        filteredLines.push(line);
                    }
                }
            } else {
                // Not an edge line (node definition, graph properties, etc.) - always include
                filteredLines.push(line);
            }
        }

        return filteredLines.join('\n');
    }

    // Handle filter selection changes
    onFilterChange(event) {
        const checkbox = event.target;
        const value = checkbox.value;

        if (value === 'all') {
            if (checkbox.checked) {
                // If "Show All" is checked, clear other selections and select all
                this.selectedLabels.clear();
                this.selectedLabels.add('all');

                // Uncheck all other checkboxes
                document.querySelectorAll('#edgeFilterContent input[type="checkbox"]').forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = false;
                    }
                });
            } else {
                // If "Show All" is unchecked, remove it from selection
                this.selectedLabels.delete('all');
            }
        } else {
            // Handle specific label selection
            if (checkbox.checked) {
                this.selectedLabels.add(value);
                // If any specific label is selected, uncheck "Show All"
                this.selectedLabels.delete('all');
                document.getElementById('filter-all').checked = false;
            } else {
                this.selectedLabels.delete(value);

                // If no specific labels selected, default to "Show All"
                if (this.selectedLabels.size === 0) {
                    this.selectedLabels.add('all');
                    document.getElementById('filter-all').checked = true;
                }
            }
        }

        this.updateDropdownLabel();
        this.applyFilter();
    }

    // Apply the current filter and re-render the graph with debouncing
    applyFilter() {
        if (!this.visualizer.currentDot) {
            return;
        }

        // Clear existing timeout
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }

        // Debounce filter application for better performance
        this.filterTimeout = setTimeout(() => {
            try {
                // Use the current DOT content from the editor
                const currentDot = document.getElementById('dotEditor').value.trim();
                const filteredDot = this.filterDotContent(currentDot, this.selectedLabels);

                // Re-render the graph with filtered content
                this.visualizer.renderFilteredGraph(filteredDot);

            } catch (error) {
                console.error('Error applying filter:', error);
                this.visualizer.showMessage('Error applying edge filter', 'error');
            }
        }, 200); // 200ms debounce
    }

    // Toggle dropdown visibility
    toggleDropdown() {
        const dropdownHeader = document.querySelector('.dropdown-header');
        const dropdownContent = document.getElementById('edgeFilterContent');

        this.isDropdownOpen = !this.isDropdownOpen;

        if (this.isDropdownOpen) {
            dropdownHeader.classList.add('active');
            dropdownContent.classList.add('show');
        } else {
            dropdownHeader.classList.remove('active');
            dropdownContent.classList.remove('show');
        }
    }

    // Close dropdown when clicking outside
    closeDropdown() {
        if (this.isDropdownOpen) {
            const dropdownHeader = document.querySelector('.dropdown-header');
            const dropdownContent = document.getElementById('edgeFilterContent');

            dropdownHeader.classList.remove('active');
            dropdownContent.classList.remove('show');
            this.isDropdownOpen = false;
        }
    }

    // Setup event listeners for the edge filter
    setupEventListeners() {
        const dropdownHeader = document.querySelector('.dropdown-header');
        const dropdownContent = document.getElementById('edgeFilterContent');

        // Toggle dropdown on header click
        dropdownHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Prevent dropdown close when clicking inside content
        dropdownContent.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeDropdown();
        });

        // Close dropdown on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDropdownOpen) {
                this.closeDropdown();
            }
        });
    }

    // Reset filter to show all edges
    resetFilter() {
        this.selectedLabels.clear();
        this.selectedLabels.add('all');
        this.updateFilterDropdown();
        this.applyFilter();
    }
}
