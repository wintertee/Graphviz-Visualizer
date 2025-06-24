// SVG Pan and Zoom Handler Class with improved performance and error handling
export class SVGPanZoomHandler {
    constructor(svg, svgState) {
        this.svg = svg;
        this.svgState = svgState;
        this.isPointerDown = false;
        this.screenPointerOrigin = { x: 0, y: 0 };
        this.viewBoxAtPointerDown = null;
        this.lastPinchDistance = 0;

        // Performance optimization: bind methods once
        this.boundMethods = {
            onPointerMove: this.onPointerMove.bind(this),
            onPointerUp: this.onPointerUp.bind(this)
        };

        // Touch handling improvements
        this.touchHandling = {
            touches: new Map(),
            gestureStartDistance: 0,
            gestureStartScale: 1
        };
    }

    cleanup() {
        this.unbindMoveEvents();
        this.touchHandling.touches.clear();
    }

    updateViewBox() {
        if (this.svgState.viewBox && Array.isArray(this.svgState.viewBox)) {
            this.svg.setAttribute('viewBox', this.svgState.viewBox.join(' '));
        }
    }

    handleZoom(zoomFactor, screenCenter) {
        try {
            const ctm = this.svg.getScreenCTM();
            if (!ctm) {
                console.warn('Could not get screen CTM for SVG zoom');
                return;
            }

            // Validate zoom factor
            if (!zoomFactor || zoomFactor <= 0) {
                console.warn('Invalid zoom factor:', zoomFactor);
                return;
            }

            const pt = this.svg.createSVGPoint();
            pt.x = screenCenter.x;
            pt.y = screenCenter.y;

            const svgCenter = pt.matrixTransform(ctm.inverse());

            const newWidth = this.svgState.viewBox[2] * zoomFactor;
            const newHeight = this.svgState.viewBox[3] * zoomFactor;

            this.svgState.viewBox[0] = svgCenter.x - (svgCenter.x - this.svgState.viewBox[0]) * zoomFactor;
            this.svgState.viewBox[1] = svgCenter.y - (svgCenter.y - this.svgState.viewBox[1]) * zoomFactor;
            this.svgState.viewBox[2] = newWidth;
            this.svgState.viewBox[3] = newHeight;

            this.updateViewBox();

        } catch (error) {
            console.error('Error during zoom operation:', error);
        }
    }

    onPointerDown(e) {
        e.preventDefault();
        this.isPointerDown = true;

        if (e.touches) {
            this.screenPointerOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            if (e.touches.length >= 2) {
                this.lastPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        } else {
            this.screenPointerOrigin = { x: e.clientX, y: e.clientY };
        }

        this.viewBoxAtPointerDown = [...this.svgState.viewBox];
        this.svg.style.cursor = 'grabbing';

        this.bindMoveEvents();
    }

    bindMoveEvents() {
        document.addEventListener('mousemove', this.boundMethods.onPointerMove);
        document.addEventListener('mouseup', this.boundMethods.onPointerUp);
        document.addEventListener('touchmove', this.boundMethods.onPointerMove, { passive: false });
        document.addEventListener('touchend', this.boundMethods.onPointerUp);
        document.addEventListener('touchcancel', this.boundMethods.onPointerUp);
    }

    unbindMoveEvents() {
        document.removeEventListener('mousemove', this.boundMethods.onPointerMove);
        document.removeEventListener('mouseup', this.boundMethods.onPointerUp);
        document.removeEventListener('touchmove', this.boundMethods.onPointerMove);
        document.removeEventListener('touchend', this.boundMethods.onPointerUp);
        document.removeEventListener('touchcancel', this.boundMethods.onPointerUp);
    }

    onPointerMove(e) {
        if (!this.isPointerDown) return;
        e.preventDefault();

        if (e.touches && e.touches.length >= 2) {
            this.handlePinchZoom(e);
        } else {
            this.handlePan(e);
        }
    }

    handlePinchZoom(e) {
        const newPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );

        if (this.lastPinchDistance > 0) {
            const zoomFactor = this.lastPinchDistance / newPinchDistance;
            const screenCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
            this.handleZoom(zoomFactor, screenCenter);

            // Update origins for smooth combined pan/zoom
            this.viewBoxAtPointerDown = [...this.svgState.viewBox];
            this.lastPinchDistance = newPinchDistance;
            this.screenPointerOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    handlePan(e) {
        const ctm = this.svg.getScreenCTM();
        if (!ctm) return;

        const ctmInverse = ctm.inverse();

        const ptOrigin = this.svg.createSVGPoint();
        ptOrigin.x = this.screenPointerOrigin.x;
        ptOrigin.y = this.screenPointerOrigin.y;
        const svgOrigin = ptOrigin.matrixTransform(ctmInverse);

        const ptCurrent = this.svg.createSVGPoint();
        if (e.touches) {
            ptCurrent.x = e.touches[0].clientX;
            ptCurrent.y = e.touches[0].clientY;
        } else {
            ptCurrent.x = e.clientX;
            ptCurrent.y = e.clientY;
        }
        const svgCurrent = ptCurrent.matrixTransform(ctmInverse);

        const dx = svgCurrent.x - svgOrigin.x;
        const dy = svgCurrent.y - svgOrigin.y;

        this.svgState.viewBox[0] = this.viewBoxAtPointerDown[0] - dx;
        this.svgState.viewBox[1] = this.viewBoxAtPointerDown[1] - dy;
        this.updateViewBox();
    }

    onPointerUp(e) {
        this.isPointerDown = false;
        this.lastPinchDistance = 0;
        this.svg.style.cursor = 'grab';
        this.unbindMoveEvents();
    }

    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        this.handleZoom(zoomFactor, { x: e.clientX, y: e.clientY });
    }
}
