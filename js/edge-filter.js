// Edge filter module for filtering edges by label
import { DOT_PATTERNS, DOT_VALUE_EXTRACTORS, DOT_EDGE_VALIDATORS } from './dot-regex-patterns.js';

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
            // Parse edges using the same logic as filtering to handle multi-line definitions
            const lines = dotContent.split('\n');
            let i = 0;

            while (i < lines.length) {
                const line = lines[i];
                const trimmedLine = line.trim();

                // Check if this line starts an edge definition
                // More precise check: not inside attribute brackets and matches edge pattern
                if (DOT_EDGE_VALIDATORS.isEdgeDefinitionLine(trimmedLine)) {
                    // Parse the complete edge definition
                    const edgeBlock = this.parseCompleteEdge(lines, i);

                    if (edgeBlock.edgeText) {
                        // Check if the complete edge has a label
                        const labelMatch = edgeBlock.edgeText.match(DOT_PATTERNS.ATTRIBUTE.LABEL);
                        if (labelMatch) {
                            const labelValue = DOT_VALUE_EXTRACTORS.extractValue(labelMatch, 1);
                            this.edgeLabels.add(labelValue);
                        }
                    }

                    // Skip to after this edge block
                    i = edgeBlock.endLineIndex + 1;
                } else {
                    i++;
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
        const showAllChecked = this.selectedLabels.has('all');

        // Clear existing options except "Show All"
        dropdownContent.innerHTML = `
            <div class="filter-option all-edges">
                <input type="checkbox" id="filter-all" value="all" ${showAllChecked ? 'checked' : ''}>
                <label for="filter-all">Show All Edges</label>
            </div>
        `;

        // Add options for each unique edge label
        labels.forEach((label, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'filter-option';
            // If "Show All" is checked, also check this option and add to selectedLabels
            const isChecked = this.selectedLabels.has(label) || showAllChecked;
            if (showAllChecked) {
                this.selectedLabels.add(label);
            }
            optionDiv.innerHTML = `
                <input type="checkbox" id="filter-${index}" value="${label}" ${isChecked ? 'checked' : ''}>
                <label for="filter-${index}">${label}</label>
            `;
            dropdownContent.appendChild(optionDiv);
        });

        // Add option for edges without labels
        const unlabeledDiv = document.createElement('div');
        unlabeledDiv.className = 'filter-option';
        const unlabeledChecked = this.selectedLabels.has('__no_label__') || showAllChecked;
        if (showAllChecked) {
            this.selectedLabels.add('__no_label__');
        }
        unlabeledDiv.innerHTML = `
            <input type="checkbox" id="filter-no-label" value="__no_label__" ${unlabeledChecked ? 'checked' : ''}>
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

        // Parse the entire DOT content to identify complete edge structures
        const lines = dotContent.split('\n');
        const filteredLines = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Check if this line starts an edge definition
            if (DOT_EDGE_VALIDATORS.isEdgeDefinitionLine(trimmedLine)) {
                // This might be a multi-line edge definition
                const edgeBlock = this.parseCompleteEdge(lines, i);

                if (edgeBlock.edgeText) {
                    // Check if the complete edge has a label
                    const labelMatch = edgeBlock.edgeText.match(DOT_PATTERNS.ATTRIBUTE.LABEL);

                    if (labelMatch) {
                        const edgeLabel = DOT_VALUE_EXTRACTORS.extractValue(labelMatch, 1);
                        // Only include this edge if its label is selected
                        if (selectedLabels.has(edgeLabel)) {
                            // Add all lines of this edge
                            for (let j = i; j <= edgeBlock.endLineIndex; j++) {
                                filteredLines.push(lines[j]);
                            }
                        }
                    } else {
                        // Edge without label - include if "no label" option is selected
                        if (selectedLabels.has('__no_label__')) {
                            // Add all lines of this edge
                            for (let j = i; j <= edgeBlock.endLineIndex; j++) {
                                filteredLines.push(lines[j]);
                            }
                        }
                    }
                }

                // Skip to after this edge block
                i = edgeBlock.endLineIndex + 1;
            } else {
                // Check if this line starts a node definition
                if (DOT_EDGE_VALIDATORS.isNodeDefinitionLine(trimmedLine)) {

                    // This might be a multi-line node definition
                    const nodeBlock = this.parseCompleteNode(lines, i);

                    // Always include node definitions (nodes are not filtered, only edges)
                    for (let j = i; j <= nodeBlock.endLineIndex; j++) {
                        filteredLines.push(lines[j]);
                    }

                    // Skip to after this node block
                    i = nodeBlock.endLineIndex + 1;
                } else {
                    // Other lines (graph properties, comments, etc.) - always include
                    filteredLines.push(line);
                    i++;
                }
            }
        }

        return filteredLines.join('\n');
    }

    // Parse a complete edge definition that might span multiple lines
    parseCompleteEdge(lines, startIndex) {
        let edgeText = '';
        let currentIndex = startIndex;
        let bracketDepth = 0;
        let foundOpenBracket = false;

        // Continue parsing until we have a complete edge definition
        while (currentIndex < lines.length) {
            const line = lines[currentIndex];
            const trimmedLine = line.trim();

            edgeText += line;
            if (currentIndex < lines.length - 1) {
                edgeText += '\n';
            }

            // Count brackets to determine when edge definition ends
            for (let char of line) {
                if (char === '[') {
                    bracketDepth++;
                    foundOpenBracket = true;
                } else if (char === ']') {
                    bracketDepth--;
                }
            }

            // If we found brackets and they're balanced, or if no brackets at all
            if ((foundOpenBracket && bracketDepth === 0) ||
                (!foundOpenBracket && (trimmedLine.endsWith(';') || !trimmedLine.includes('=')))) {
                break;
            }

            currentIndex++;
        }

        return {
            edgeText: edgeText,
            endLineIndex: currentIndex
        };
    }

    // Parse a complete node definition that might span multiple lines
    parseCompleteNode(lines, startIndex) {
        let nodeText = '';
        let currentIndex = startIndex;
        let bracketDepth = 0;
        let foundOpenBracket = false;

        // Continue parsing until we have a complete node definition
        while (currentIndex < lines.length) {
            const line = lines[currentIndex];
            const trimmedLine = line.trim();

            nodeText += line;
            if (currentIndex < lines.length - 1) {
                nodeText += '\n';
            }

            // Count brackets to determine when node definition ends
            for (let char of line) {
                if (char === '[') {
                    bracketDepth++;
                    foundOpenBracket = true;
                } else if (char === ']') {
                    bracketDepth--;
                }
            }

            // If we found brackets and they're balanced, or if no brackets at all
            if ((foundOpenBracket && bracketDepth === 0) ||
                (!foundOpenBracket && (trimmedLine.endsWith(';') || !trimmedLine.includes('=')))) {
                break;
            }

            currentIndex++;
        }

        return {
            nodeText: nodeText,
            endLineIndex: currentIndex
        };
    }

    // Handle filter selection changes
    onFilterChange(event) {
        const checkbox = event.target;
        const value = checkbox.value;

        if (value === 'all') {
            if (checkbox.checked) {
                // If "Show All" is checked, automatically check all other options
                this.selectedLabels.clear();
                this.selectedLabels.add('all');

                // Check all other checkboxes and add them to selectedLabels
                document.querySelectorAll('#edgeFilterContent input[type="checkbox"]').forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = true;
                        this.selectedLabels.add(cb.value);
                    }
                });
            } else {
                // If "Show All" is unchecked, uncheck all other options
                this.selectedLabels.delete('all');
                document.querySelectorAll('#edgeFilterContent input[type="checkbox"]').forEach(cb => {
                    if (cb.value !== 'all') {
                        cb.checked = false;
                        this.selectedLabels.delete(cb.value);
                    }
                });
            }
        } else {
            // Handle specific label selection
            if (checkbox.checked) {
                this.selectedLabels.add(value);

                // Check if all individual options are now selected
                const allCheckboxes = document.querySelectorAll('#edgeFilterContent input[type="checkbox"]');
                const individualCheckboxes = Array.from(allCheckboxes).filter(cb => cb.value !== 'all');
                const allIndividualChecked = individualCheckboxes.every(cb => cb.checked);

                // If all individual options are checked, also check "Show All"
                if (allIndividualChecked && individualCheckboxes.length > 0) {
                    this.selectedLabels.add('all');
                    document.getElementById('filter-all').checked = true;
                }
            } else {
                this.selectedLabels.delete(value);

                // If any specific label is unchecked, uncheck "Show All"
                this.selectedLabels.delete('all');
                document.getElementById('filter-all').checked = false;

                // If no specific labels selected, default to "Show All"
                if (this.selectedLabels.size === 0) {
                    this.selectedLabels.add('all');
                    document.getElementById('filter-all').checked = true;

                    // Also check all other checkboxes
                    document.querySelectorAll('#edgeFilterContent input[type="checkbox"]').forEach(cb => {
                        if (cb.value !== 'all') {
                            cb.checked = true;
                            this.selectedLabels.add(cb.value);
                        }
                    });
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

                // Check if edge coloring is enabled
                if (this.visualizer.edgeColoring.isEnabled) {
                    // Apply coloring to filtered content
                    this.visualizer.edgeColoring.parseEdgeTypes(filteredDot);
                    const coloredFilteredDot = this.visualizer.edgeColoring.applyColoring(filteredDot);
                    this.visualizer.edgeColoring.showColorLegend();
                    this.visualizer.renderColoredGraph(coloredFilteredDot);
                } else {
                    // Re-render the graph with filtered content only
                    this.visualizer.renderFilteredGraph(filteredDot);
                }

            } catch (error) {
                console.error('Error applying filter:', error);
                this.visualizer.showMessage('Error applying edge filter', 'error');
            }
        }, 200); // 200ms debounce
    }

    // Get the current filtered DOT content without re-rendering
    getCurrentFilteredContent() {
        if (!this.visualizer.currentDot) {
            return '';
        }

        const currentDot = document.getElementById('dotEditor').value.trim();
        return this.filterDotContent(currentDot, this.selectedLabels);
    }

    // Check if filter is currently active (not showing all edges)
    isFilterActive() {
        return !this.selectedLabels.has('all') && this.selectedLabels.size > 0;
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

        // After updating the dropdown, also check all individual options
        setTimeout(() => {
            document.querySelectorAll('#edgeFilterContent input[type="checkbox"]').forEach(cb => {
                if (cb.value !== 'all') {
                    cb.checked = true;
                    this.selectedLabels.add(cb.value);
                }
            });
        }, 0);

        this.applyFilter();
    }
}
