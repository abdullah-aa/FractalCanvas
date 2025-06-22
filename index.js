// Get the canvas element and its context
const canvas = document.getElementById('fractalCanvas');
const ctx = canvas.getContext('2d');

// Variables for fractal generation
let width, height;
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let colorShift = 0;
let maxIterations = 200; // Balanced for performance and precision

// Device detection
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Balanced rendering variables
let renderQuality = 1; // Start with high quality, but allow dynamic adjustment
let isRendering = false;
let lastRenderTime = 0;
const targetFrameTime = 60; // Target ~16fps for a responsive experience with good detail

// Variables for camera dragging
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Current target point for zooming
let targetX = -0.5;
let targetY = 0;
let zoomingToTarget = false;
let zoomDuration = 500; // Frames to spend zooming to a target
let zoomProgress = 0;

// Function to resize the canvas to fill the window
function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

// Initialize canvas size
resizeCanvas();

// Add event listener for window resize
window.addEventListener('resize', resizeCanvas);

// Function to map a value from one range to another
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Function to toggle overlay visibility
function toggleOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;

    const toggleBtn = overlay.querySelector('.toggle-btn');
    if (!toggleBtn) return;

    if (overlay.classList.contains('collapsed')) {
        // Expand
        overlay.classList.remove('collapsed');
        toggleBtn.textContent = '[-]';
    } else {
        // Collapse
        overlay.classList.add('collapsed');
        toggleBtn.textContent = '[+]';
    }
}

// Function to display performance metrics
function displayMetrics() {
    const metrics = document.getElementById('metrics');
    if (!metrics) return;

    const metricsContent = metrics.querySelector('.overlay-content');
    if (!metricsContent) return;

    const detailLevel = calculateDetailLevel();

    metricsContent.innerHTML = `
        <div>Zoom: ${zoomLevel.toFixed(2)}</div>
        <div>Quality: ${renderQuality.toFixed(2)}</div>
        <div>Render time: ${lastRenderTime.toFixed(1)}ms</div>
        <div>Iterations: ${maxIterations}</div>
        <div>Detail Level: ${detailLevel}</div>
        <div>Position: (${offsetX.toFixed(6)}, ${offsetY.toFixed(6)})</div>
    `;
}

// Function to generate the Mandelbrot set with dynamic resolution
function generateMandelbrot() {
    if (isRendering) {
        // Still update metrics even if we skip rendering
        displayMetrics();
        return;
    }
    isRendering = true;

    // Force render quality to a lower value when dragging for better performance
    if (isDragging) {
        renderQuality = 4; // Higher value = lower quality = faster rendering during drag
    }

    const startTime = performance.now();

    // Create an ImageData object to manipulate pixels directly
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Calculate the step size based on render quality
    const step = Math.max(1, Math.floor(renderQuality));

    // For each pixel in the canvas (with dynamic resolution)
    for (let x = 0; x < width; x += step) {
        for (let y = 0; y < height; y += step) {
            // Map canvas coordinates to complex plane
            const zoomFactor = Math.exp(zoomLevel);
            const aspectRatio = width / height;

            // Calculate real and imaginary parts of complex number
            const real = mapRange(x, 0, width, -2.5 / zoomFactor, 1 / zoomFactor) + offsetX;
            const imag = mapRange(y, 0, height, -1 / zoomFactor, 1 / zoomFactor) / aspectRatio + offsetY;

            // Variables for the Mandelbrot calculation
            let zReal = 0;
            let zImag = 0;
            let iteration = 0;

            // Perform the Mandelbrot iteration
            while (zReal * zReal + zImag * zImag < 4 && iteration < maxIterations) {
                // z = z^2 + c
                const tempReal = zReal * zReal - zImag * zImag + real;
                const tempImag = 2 * zReal * zImag + imag;

                zReal = tempReal;
                zImag = tempImag;

                iteration++;
            }

            // Calculate color based on iteration count
            let color;
            if (iteration === maxIterations) {
                color = [0, 0, 0]; // Black for points in the set
            } else {
                // Create a smooth color gradient
                const smoothColor = iteration + 1 - Math.log(Math.log(Math.sqrt(zReal * zReal + zImag * zImag))) / Math.log(2);

                // Use HSL to RGB conversion for vibrant colors
                const hue = (smoothColor * 10 + colorShift) % 360;
                const saturation = 100;
                const lightness = 50;

                // Convert HSL to RGB
                const c = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100;
                const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
                const m = lightness / 100 - c / 2;

                let r, g, b;
                if (hue < 60) {
                    [r, g, b] = [c, x, 0];
                } else if (hue < 120) {
                    [r, g, b] = [x, c, 0];
                } else if (hue < 180) {
                    [r, g, b] = [0, c, x];
                } else if (hue < 240) {
                    [r, g, b] = [0, x, c];
                } else if (hue < 300) {
                    [r, g, b] = [x, 0, c];
                } else {
                    [r, g, b] = [c, 0, x];
                }

                color = [
                    Math.round((r + m) * 255),
                    Math.round((g + m) * 255),
                    Math.round((b + m) * 255)
                ];
            }

            // Fill a block of pixels with the same color (for lower resolutions)
            for (let blockX = 0; blockX < step && x + blockX < width; blockX++) {
                for (let blockY = 0; blockY < step && y + blockY < height; blockY++) {
                    const pixelIndex = ((y + blockY) * width + (x + blockX)) * 4;
                    data[pixelIndex] = color[0];     // Red
                    data[pixelIndex + 1] = color[1]; // Green
                    data[pixelIndex + 2] = color[2]; // Blue
                    data[pixelIndex + 3] = 255;      // Alpha (fully opaque)
                }
            }
        }
    }

    // Put the image data back to the canvas
    ctx.putImageData(imageData, 0, 0);

    // Calculate render time and adjust quality if needed
    const renderTime = performance.now() - startTime;
    lastRenderTime = renderTime;

    // Dynamically adjust quality based on performance, but favor higher quality
    // Only auto-adjust quality when not dragging
    if (!isDragging) {
        if (renderTime > targetFrameTime * 1.5) {
            // Too slow, decrease quality but more conservatively
            renderQuality = Math.min(4, renderQuality + 0.5); // Cap at 4x for better quality
        } else if (renderTime < targetFrameTime * 0.7 && renderQuality > 1) {
            // Fast enough, increase quality more aggressively when screen is not moving
            renderQuality = Math.max(0.5, renderQuality - 0.3); // More aggressive quality improvement
        }
    }

    isRendering = false;
}

// Animation parameters
let time = 0;
const baseZoomSpeed = 0.03; // Increased from 0.01 for faster auto zoom
let zoomSpeed = baseZoomSpeed;
const colorSpeed = 1;
const maxZoomLevel = 40; // Maximum zoom level before resetting

// Touch control variables
let touchStartX = 0;
let touchStartY = 0;
let lastTouchDistance = 0;
let lastTapTime = 0;
let longPressTimer = null;
let isTouching = false;

// Function to calculate the detail level based on zoom and iterations
function calculateDetailLevel() {
    // Detail level is a combination of zoom level and max iterations
    // Higher values mean more detail
    // Adjusted to reflect the balanced precision/performance settings
    return Math.floor(zoomLevel * 15) + Math.floor(maxIterations / 8);
}

// Animation function
function animate() {
    // Update parameters for endless generation
    time += 0.01;

    if (zoomingToTarget) {
        // Progress towards target point
        zoomProgress++;

        // Ease-in-out function for smooth transition
        const t = zoomProgress / zoomDuration;
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Interpolate position
        offsetX += (targetX - offsetX) * 0.01;
        offsetY += (targetY - offsetY) * 0.01;

        // Accelerate zoom as we get closer to the target
        zoomSpeed = baseZoomSpeed * (1 + easeT);

        // Increase zoom level
        zoomLevel += zoomSpeed;

        // If we've reached max zoom or completed the duration, stop automatic zooming
        if (zoomLevel > maxZoomLevel || zoomProgress >= zoomDuration) {
            zoomingToTarget = false;
        }
    }
    // Camera position controlled by dragging when automatic zooming is disabled

    // Shift colors over time
    colorShift = (colorShift + colorSpeed) % 360;

    // Moderately increase iterations for good detail as we zoom
    maxIterations = 200 + Math.floor(zoomLevel * 25);

    // Generate and render the fractal
    generateMandelbrot();

    // Update performance metrics
    displayMetrics();

    // Request next frame
    requestAnimationFrame(animate);
}

// Add mouse wheel interaction for zooming
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();

    // Get the mouse position
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Convert mouse position to complex plane coordinates
    const zoomFactor = Math.exp(zoomLevel);
    const aspectRatio = width / height;

    // Calculate the complex coordinates of the mouse position
    const real = mapRange(mouseX, 0, width, -2.5 / zoomFactor, 1 / zoomFactor) + offsetX;
    const imag = mapRange(mouseY, 0, height, -1 / zoomFactor, 1 / zoomFactor) / aspectRatio + offsetY;

    // Set the target to the mouse position
    targetX = real;
    targetY = imag;

    // Determine zoom direction based on wheel delta
    const zoomAmount = baseZoomSpeed * 10;
    if (event.deltaY < 0) {
        // Zoom in
        zoomLevel += zoomAmount;
    } else {
        // Zoom out
        zoomLevel = Math.max(0.1, zoomLevel - zoomAmount);
    }

    // Move toward the mouse point
    offsetX += (targetX - offsetX) * 0.1;
    offsetY += (targetY - offsetY) * 0.1;

    console.log(`Zoom ${event.deltaY < 0 ? 'in' : 'out'} at point: (${real}, ${imag}), new zoom level: ${zoomLevel.toFixed(2)}`);
});

// Add mouse event listeners for dragging
canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        canvas.style.cursor = 'grabbing';
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;

        // Convert screen coordinates to complex plane coordinates
        const zoomFactor = Math.exp(zoomLevel);
        const aspectRatio = width / height;

        // Calculate the amount to move in the complex plane
        const moveX = -deltaX * (3.5 / width) / zoomFactor;
        const moveY = -deltaY * (2 / height) / zoomFactor / aspectRatio;

        // Update the offset
        offsetX += moveX;
        offsetY += moveY;

        // Update last mouse position
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
});

// Add keyboard controls
document.addEventListener('keydown', (event) => {
    switch(event.key) {
        case ' ':  // Spacebar
            // Toggle automatic zooming
            zoomingToTarget = !zoomingToTarget;

            if (zoomingToTarget) {
                // If starting automatic zooming, reset zoom progress
                zoomProgress = 0;
                console.log('Starting automatic zoom');
            } else {
                console.log('Stopping automatic zoom');
            }
            break;
        case 'r':  // Reset
            zoomLevel = 1;
            offsetX = 0;
            offsetY = 0;
            break;
    }
});

// Function to calculate distance between two touch points
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Function to reset view
function resetView() {
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    console.log('View reset');
}

// Function to toggle auto zoom
function toggleAutoZoom() {
    zoomingToTarget = !zoomingToTarget;
    if (zoomingToTarget) {
        zoomProgress = 0;
        console.log('Starting automatic zoom');
    } else {
        console.log('Stopping automatic zoom');
    }
}

// Add touch controls for mobile devices
if (isMobile) {
    // Touch start event
    canvas.addEventListener('touchstart', (event) => {
        event.preventDefault();

        // Clear any existing long press timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }

        isTouching = true;

        // Set up long press detection
        longPressTimer = setTimeout(() => {
            resetView();
            longPressTimer = null;
        }, 800); // 800 ms for long press

        // Handle multi-touch (pinch)
        if (event.touches.length === 2) {
            lastTouchDistance = getTouchDistance(event.touches);
        } 
        // Handle single touch (tap/swipe)
        else if (event.touches.length === 1) {
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;

            // Check for double tap
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTapTime;

            if (tapLength < 300 && tapLength > 0) {
                // Double tap detected
                toggleAutoZoom();

                // Convert touch position to complex plane coordinates for zoom target
                const zoomFactor = Math.exp(zoomLevel);
                const aspectRatio = width / height;

                // Calculate the complex coordinates of the touch position
                targetX = mapRange(touchStartX, 0, width, -2.5 / zoomFactor, 1 / zoomFactor) + offsetX;
                targetY = mapRange(touchStartY, 0, height, -1 / zoomFactor, 1 / zoomFactor) / aspectRatio + offsetY;

                // Prevent additional actions
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }

            lastTapTime = currentTime;
        }
    });

    // Touch move event
    canvas.addEventListener('touchmove', (event) => {
        event.preventDefault();

        // Clear long press timer on movement
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // Handle pinch-to-zoom (two fingers)
        if (event.touches.length === 2) {
            const currentDistance = getTouchDistance(event.touches);

            // Calculate zoom based on pinch distance change
            if (lastTouchDistance > 0) {
                const distanceChange = currentDistance - lastTouchDistance;
                const zoomAmount = distanceChange * 0.01;

                // Apply zoom
                zoomLevel = Math.max(0.1, zoomLevel + zoomAmount);

                // Set target to center of the two touch points
                const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
                const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;

                // Convert center position to complex plane coordinates
                const zoomFactor = Math.exp(zoomLevel);
                const aspectRatio = width / height;

                targetX = mapRange(centerX, 0, width, -2.5 / zoomFactor, 1 / zoomFactor) + offsetX;
                targetY = mapRange(centerY, 0, height, -1 / zoomFactor, 1 / zoomFactor) / aspectRatio + offsetY;

                // Move toward the target point
                offsetX += (targetX - offsetX) * 0.1;
                offsetY += (targetY - offsetY) * 0.1;
            }

            lastTouchDistance = currentDistance;
        } 
        // Handle swipe (one finger)
        else if (event.touches.length === 1 && isTouching) {
            const touchX = event.touches[0].clientX;
            const touchY = event.touches[0].clientY;

            const deltaX = touchX - touchStartX;
            const deltaY = touchY - touchStartY;

            // Convert screen coordinates to complex plane coordinates
            const zoomFactor = Math.exp(zoomLevel);
            const aspectRatio = width / height;

            // Calculate the amount to move in the complex plane
            const moveX = -deltaX * (3.5 / width) / zoomFactor;
            const moveY = -deltaY * (2 / height) / zoomFactor / aspectRatio;

            // Update the offset
            offsetX += moveX;
            offsetY += moveY;

            // Update touch start position for next move
            touchStartX = touchX;
            touchStartY = touchY;
        }
    });

    // Touch end event
    canvas.addEventListener('touchend', (event) => {
        event.preventDefault();

        // Clear long press timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        isTouching = false;
        lastTouchDistance = 0;
    });

    // Touch cancel event
    canvas.addEventListener('touchcancel', (event) => {
        event.preventDefault();

        // Clear long press timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        isTouching = false;
        lastTouchDistance = 0;
    });

    // Update instructions for mobile
    const instructionsDiv = document.getElementById('instructions');
    if (instructionsDiv) {
        const instructionsContent = instructionsDiv.querySelector('.overlay-content');
        if (instructionsContent) {
            instructionsContent.innerHTML = `
                <p>Explore the endless nature of the Mandelbrot set:</p>
                <ul>
                    <li><strong>Tap and swipe</strong> to move the camera around</li>
                    <li><strong>Pinch</strong> to zoom in/out</li>
                    <li><strong>Double tap</strong> to start/stop automatic zooming</li>
                    <li><strong>Long press</strong> to reset the view</li>
                </ul>
                <p><small>Rendering balances detail and performance for a smooth exploration experience.</small></p>
            `;
        }
    }
}

// Start the animation
animate();
