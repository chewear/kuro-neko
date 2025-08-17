/**
 * KuroNeko Game - A 2D survival game where a cat protects its owner from ghosts
 * 
 * Game Mechanics:
 * - Player controls a cat using WASD or arrow keys
 * - Cat must catch ghosts before they reach the owner
 * - Regular ghosts (white) and red ghosts (faster, more dangerous)
 * - Lives decrease when ghosts reach the owner
 * - Score increases when cat catches ghosts
 * - Persistent high score tracking using localStorage
 */

// ===== INITIALIZATION & SETUP =====

/**
 * Initialize high score from localStorage
 * Creates initial high score of 0 if none exists
 */
if (localStorage.getItem('KuroNeko_HighScore') === null) {
    localStorage.setItem('KuroNeko_HighScore', '0');
}

// Canvas and rendering context setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM element references for UI updates
const scoreElement = document.getElementById('scoreValue');
const highScoreElement = document.getElementById('highScoreValue');
const livesElement = document.getElementById('livesValue');
const gameOverElement = document.getElementById('gameOver');
const startScreenElement = document.getElementById('startScreen');
const finalScoreElement = document.getElementById('finalScore');

// ===== SPRITE ASSETS =====

/**
 * Game sprite assets
 * All sprites are loaded as Image objects for hardware-accelerated rendering
 */
const catSprite = new Image();           // Player-controlled cat sprite
const ghostSprite = new Image();         // Regular white ghost enemy
const redGhostSprite = new Image();      // Fast red ghost enemy
const playerSprite = new Image();        // Owner/player character sprite

// Load sprite assets from asset directory
ghostSprite.src = 'asset/ghost.png';
redGhostSprite.src = 'asset/red.png'; 
catSprite.src = 'asset/neko.png';
playerSprite.src = 'asset/player.png';

// ===== GAME TIMING CONSTANTS =====

/**
 * Red ghost spawn timing
 * Red ghosts spawn every 7 seconds and are faster than regular ghosts
 */
let lastRedGhostTime = 0;
const RED_GHOST_INTERVAL = 7000; // 7 seconds in milliseconds

// ===== WORLD DIMENSIONS & VIEWPORT =====

/**
 * World and viewport configuration
 * The game world is larger than the viewport, requiring camera following
 */
const WORLD_WIDTH = 2000;     // Total world width in pixels
const WORLD_HEIGHT = 2000;    // Total world height in pixels
const CANVAS_WIDTH = 800;     // Viewport width
const CANVAS_HEIGHT = 600;    // Viewport height
const GRID_SIZE = 50;         // Grid cell size for visual reference

// ===== ENEMY SPAWN LIMITS =====

/**
 * Maximum enemy counts to prevent performance issues
 * Balances difficulty with system performance
 */
const MAX_REGULAR_GHOSTS = 9;  // Maximum white ghosts on screen
const MAX_RED_GHOSTS = 2;      // Maximum red ghosts on screen

// ===== GAME STATE VARIABLES =====

let gameRunning = false;       // Main game loop control flag
let score = 0;                 // Current game score
let highScore = parseInt(localStorage.getItem('KuroNeko_HighScore')); // Best score
let lives = 9;                 // Player lives remaining
let camera = { x: 0, y: 0 };   // Camera position for world-to-screen translation

// Initialize high score display
highScoreElement.textContent = highScore;

// ===== GAME ENTITIES =====

/**
 * Cat entity - Player-controlled character
 * Responsible for catching ghosts to protect the owner
 */
let cat = {
    x: WORLD_WIDTH / 2,        // World X position
    y: WORLD_HEIGHT / 2,       // World Y position
    radius: 15,                // Collision detection radius
    speed: 3.5,                // Movement speed per frame
    facingLeft: false          // Sprite orientation flag
};

/**
 * Owner entity - AI-controlled character that moves randomly
 * The cat must protect this character from ghosts
 */
let owner = {
    x: WORLD_WIDTH / 2 + 100,  // World X position (offset from cat start)
    y: WORLD_HEIGHT / 2 + 100, // World Y position
    radius: 12,                // Collision detection radius
    speed: 0.8,                // Movement speed per frame
    direction: Math.random() * Math.PI * 2, // Current movement direction (radians)
    changeDirectionTimer: 0,    // Timer for random direction changes
    facingLeft: false          // Sprite orientation flag
};

/**
 * Dynamic game entity arrays
 * These are populated and managed during gameplay
 */
let enemies = [];    // Array of ghost enemies
let obstacles = [];  // Array of static world obstacles

// ===== INPUT HANDLING =====

/**
 * Keyboard input state tracking
 * Supports both WASD and arrow key controls
 */
const keys = {};

// Keydown event - mark keys as pressed
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;  // Support letter keys
    keys[e.code] = true;               // Support special keys (arrows)
});

// Keyup event - mark keys as released
document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
});

// ===== WORLD GENERATION =====

/**
 * Generate random obstacles throughout the world
 * Creates visual and gameplay variety while providing navigation challenges
 */
function createObstacles() {
    obstacles = [];
    
    // Generate 20 random rectangular obstacles
    for (let i = 0; i < 20; i++) {
        obstacles.push({
            x: Math.random() * (WORLD_WIDTH - 100),   // Random X position
            y: Math.random() * (WORLD_HEIGHT - 100),  // Random Y position
            width: 40 + Math.random() * 60,           // Random width (40-100px)
            height: 40 + Math.random() * 60           // Random height (40-100px)
        });
    }
}

// ===== COLLISION DETECTION SYSTEM =====

/**
 * Circle-to-circle collision detection
 * Used for entity interactions (cat vs ghost, ghost vs owner)
 * 
 * @param {Object} obj1 - First circular object with x, y, radius
 * @param {Object} obj2 - Second circular object with x, y, radius
 * @returns {boolean} - True if objects are colliding
 */
function circleCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < obj1.radius + obj2.radius;
}

/**
 * Circle-to-rectangle collision detection
 * Used for entity vs obstacle collision detection
 * 
 * @param {Object} circle - Circular object with x, y, radius
 * @param {Object} rect - Rectangular object with x, y, width, height
 * @returns {boolean} - True if circle intersects rectangle
 */
function circleRectCollision(circle, rect) {
    // Find the closest point on the rectangle to the circle center
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    
    // Calculate distance from circle center to closest point
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    
    // Check if distance is less than circle radius
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

/**
 * Validate if an entity can move to a specific position
 * Checks against obstacles and world boundaries
 * 
 * @param {Object} obj - Entity object with radius property
 * @param {number} newX - Proposed X position
 * @param {number} newY - Proposed Y position
 * @returns {boolean} - True if position is valid
 */
function isValidPosition(obj, newX, newY) {
    // Create temporary object at new position for testing
    const tempObj = { ...obj, x: newX, y: newY };
    
    // Check collision with all obstacles
    for (let obstacle of obstacles) {
        if (circleRectCollision(tempObj, obstacle)) {
            return false;
        }
    }
    
    // Check world boundaries (keep entity fully inside world)
    return newX >= obj.radius && newX <= WORLD_WIDTH - obj.radius && 
           newY >= obj.radius && newY <= WORLD_HEIGHT - obj.radius;
}

// ===== ENTITY UPDATE FUNCTIONS =====

/**
 * Update cat position based on player input
 * Handles WASD and arrow key movement with collision detection
 */
function updateCat() {
    let newX = cat.x;
    let newY = cat.y;

    // Process input and calculate new position
    if (keys['w'] || keys['ArrowUp']) newY -= cat.speed;
    if (keys['s'] || keys['ArrowDown']) newY += cat.speed;
    if (keys['a'] || keys['ArrowLeft']) {
        newX -= cat.speed;
        cat.facingLeft = true;  // Update sprite orientation
    }
    if (keys['d'] || keys['ArrowRight']) {
        newX += cat.speed;
        cat.facingLeft = false; // Update sprite orientation
    }

    // Apply movement only if new position is valid
    // Check X and Y movement separately to allow sliding along walls
    if (isValidPosition(cat, newX, cat.y)) {
        cat.x = newX;
    }
    if (isValidPosition(cat, cat.x, newY)) {
        cat.y = newY;
    }
}

/**
 * Update owner AI movement
 * Implements random wandering behavior with direction changes
 */
function updateOwner() {
    owner.changeDirectionTimer++;
    
    // Change direction randomly every 2-6 seconds (120-360 frames at 60fps)
    if (owner.changeDirectionTimer > 120 + Math.random() * 240) {
        owner.direction = Math.random() * Math.PI * 2;
        owner.changeDirectionTimer = 0;
    }

    // Calculate movement vector from current direction
    const moveX = Math.cos(owner.direction) * owner.speed;
    const newX = owner.x + moveX;
    const newY = owner.y + Math.sin(owner.direction) * owner.speed;

    // Apply movement if position is valid, otherwise change direction
    if (isValidPosition(owner, newX, newY)) {
        owner.x = newX;
        owner.y = newY;
        
        // Update sprite orientation based on movement direction
        if (moveX !== 0) {
            owner.facingLeft = moveX < 0;
        }
    } else {
        // Hit obstacle or boundary, pick new random direction
        owner.direction = Math.random() * Math.PI * 2;
    }
}

// ===== ENEMY MANAGEMENT SYSTEM =====

/**
 * Spawn new enemy ghost
 * Controls enemy population and spawn mechanics
 * 
 * @param {boolean} isRedGhost - Whether to spawn a red ghost (faster variant)
 */
function spawnEnemy(isRedGhost = false) {
    let shouldSpawn = false;
    
    // Count current enemy types to enforce limits
    const regularGhostCount = enemies.filter(enemy => !enemy.isRed).length;
    const redGhostCount = enemies.filter(enemy => enemy.isRed).length;
    
    // Determine if we should spawn based on type and current count
    if (isRedGhost) {
        if (redGhostCount < MAX_RED_GHOSTS) {
            shouldSpawn = true;
        }
    } else if (Math.random() < 0.02) { // 2% chance per frame for regular ghosts
        if (regularGhostCount < MAX_REGULAR_GHOSTS) {
            shouldSpawn = true;
        }
    }
    
    if (shouldSpawn) {
        // Choose random edge of world for spawn location
        const side = Math.floor(Math.random() * 4);
        let x, y;

        switch (side) {
            case 0: // Top edge
                x = Math.random() * WORLD_WIDTH;
                y = 0;
                break;
            case 1: // Right edge
                x = WORLD_WIDTH;
                y = Math.random() * WORLD_HEIGHT;
                break;
            case 2: // Bottom edge
                x = Math.random() * WORLD_WIDTH;
                y = WORLD_HEIGHT;
                break;
            case 3: // Left edge
                x = 0;
                y = Math.random() * WORLD_HEIGHT;
                break;
        }

        // Create enemy with randomized speed
        const baseSpeed = 1.2 + Math.random() * 0.8;
        enemies.push({
            x: x,
            y: y,
            radius: 10,
            speed: isRedGhost ? baseSpeed * 1.5 : baseSpeed, // Red ghosts are 50% faster
            facingRight: false,
            isRed: isRedGhost
        });
    }
}

/**
 * Remove enemies that are too far from the action
 * Prevents memory leaks and improves performance
 */
function cleanupDistantEnemies() {
    const MAX_DISTANCE = WORLD_WIDTH * 0.8; // 80% of world width
    
    // Iterate backwards to safely remove elements during iteration
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dx = owner.x - enemy.x;
        const dy = owner.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Remove if too far from owner
        if (distance > MAX_DISTANCE) {
            enemies.splice(i, 1);
        }
    }
}

/**
 * Update all enemy positions and handle collisions
 * Core gameplay logic for enemy behavior and interactions
 */
function updateEnemies() {
    // Iterate backwards to safely remove enemies during loop
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Calculate direction vector toward owner
        const dx = owner.x - enemy.x;
        const dy = owner.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Move enemy toward owner if not already there
        if (distance > 0) {
            const moveX = (dx / distance) * enemy.speed;
            enemy.x += moveX;
            enemy.y += (dy / distance) * enemy.speed;
            enemy.facingRight = moveX > 0; // Update sprite orientation
        }

        // Check collision with cat (player scores)
        if (circleCollision(enemy, cat)) {
            enemies.splice(i, 1);  // Remove enemy
            score += 1;            // Increase score
            scoreElement.textContent = score;
            
            // Update high score if necessary
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('KuroNeko_HighScore', highScore);
                highScoreElement.textContent = highScore;
            }
            continue; // Skip to next enemy
        }
        
        // Check collision with owner (player loses life)
        if (circleCollision(enemy, owner)) {
            enemies.splice(i, 1);  // Remove enemy
            lives--;               // Decrease lives
            livesElement.textContent = lives;
            
            // Check for game over condition
            if (lives <= 0) {
                gameRunning = false;
                gameOverElement.style.display = 'block';
                finalScoreElement.textContent = score;
            }
            continue; // Skip to next enemy
        }

        // Remove enemies that have moved too far from the world
        if (distance > WORLD_WIDTH) {
            enemies.splice(i, 1);
        }
    }
}

// ===== CAMERA SYSTEM =====

/**
 * Update camera position to follow the owner
 * Implements smooth camera following with world boundary constraints
 */
function updateCamera() {
    // Center camera on owner
    camera.x = owner.x - CANVAS_WIDTH / 2;
    camera.y = owner.y - CANVAS_HEIGHT / 2;

    // Clamp camera to world boundaries
    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - CANVAS_WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - CANVAS_HEIGHT));
}

// ===== RENDERING SYSTEM =====

/**
 * Draw background grid for visual reference
 * Provides spatial awareness and visual appeal
 */
function drawGrid() {
    ctx.strokeStyle = '#222';  // Dark gray grid lines
    ctx.lineWidth = 1;

    // Calculate grid starting points based on camera position
    const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;

    // Draw vertical grid lines
    for (let x = startX; x < camera.x + CANVAS_WIDTH + GRID_SIZE; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x - camera.x, 0);
        ctx.lineTo(x - camera.x, CANVAS_HEIGHT);
        ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = startY; y < camera.y + CANVAS_HEIGHT + GRID_SIZE; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y - camera.y);
        ctx.lineTo(CANVAS_WIDTH, y - camera.y);
        ctx.stroke();
    }
}

/**
 * Main rendering function
 * Draws all game elements in proper layered order
 */
function draw() {
    // Clear canvas with dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background grid
    drawGrid();

    // Draw obstacles (behind entities)
    ctx.fillStyle = '#444';
    for (let obstacle of obstacles) {
        // Convert world coordinates to screen coordinates
        const screenX = obstacle.x - camera.x;
        const screenY = obstacle.y - camera.y;
        
        // Only draw if obstacle is visible on screen (performance optimization)
        if (screenX + obstacle.width >= 0 && screenX <= CANVAS_WIDTH &&
            screenY + obstacle.height >= 0 && screenY <= CANVAS_HEIGHT) {
            ctx.fillRect(screenX, screenY, obstacle.width, obstacle.height);
        }
    }

    // Draw enemies
    for (let enemy of enemies) {
        // Convert world coordinates to screen coordinates
        const screenX = enemy.x - camera.x;
        const screenY = enemy.y - camera.y;
        
        // Only draw if enemy is visible on screen
        if (screenX >= -enemy.radius && screenX <= CANVAS_WIDTH + enemy.radius &&
            screenY >= -enemy.radius && screenY <= CANVAS_HEIGHT + enemy.radius) {
            
            // Choose appropriate sprite based on enemy type
            const currentSprite = enemy.isRed ? redGhostSprite : ghostSprite;
            
            // Draw sprite if loaded
            if (currentSprite && currentSprite.complete) {
                const spriteSize = enemy.radius * 3;
                ctx.save();

                // Handle sprite flipping for direction
                if (!enemy.facingRight) {
                    // Normal orientation
                    ctx.drawImage(currentSprite,
                        screenX - spriteSize/2,
                        screenY - spriteSize/2,
                        spriteSize,
                        spriteSize
                    );
                } else {
                    // Flipped horizontally
                    ctx.scale(-1, 1);
                    ctx.drawImage(currentSprite,
                        -screenX - spriteSize/2,
                        screenY - spriteSize/2,
                        spriteSize,
                        spriteSize
                    );
                }
                ctx.restore();
            }
            
            // Add subtle glow effect (optional visual enhancement)
            ctx.shadowColor = '#ffffff44';
            ctx.shadowBlur = 15;
            ctx.shadowBlur = 0; // Reset shadow for next draws
        }
    }

    // Draw owner (player character)
    const ownerScreenX = owner.x - camera.x;
    const ownerScreenY = owner.y - camera.y;
    if (playerSprite && playerSprite.complete) {
        const spriteSize = owner.radius * 8; // Larger sprite for visibility
        ctx.save();
        
        // Handle sprite orientation
        if (owner.facingLeft) {
            ctx.scale(-1, 1);
            ctx.drawImage(playerSprite,
                -ownerScreenX - spriteSize/2,
                ownerScreenY - spriteSize/2,
                spriteSize,
                spriteSize
            );
        } else {
            ctx.drawImage(playerSprite,
                ownerScreenX - spriteSize/2,
                ownerScreenY - spriteSize/2,
                spriteSize,
                spriteSize
            );
        }
        ctx.restore();
    }

    // Draw cat (on top of everything else for visibility)
    const catScreenX = cat.x - camera.x;
    const catScreenY = cat.y - camera.y;
    if (catSprite && catSprite.complete) {
        const spriteSize = cat.radius * 3;
        ctx.save();
        
        // Handle sprite orientation
        if (cat.facingLeft) {
            ctx.scale(-1, 1);
            ctx.drawImage(catSprite, 
                -catScreenX - spriteSize/2, 
                catScreenY - spriteSize/2,
                spriteSize,
                spriteSize
            );
        } else {
            ctx.drawImage(catSprite, 
                catScreenX - spriteSize/2, 
                catScreenY - spriteSize/2,
                spriteSize,
                spriteSize
            );
        }
        ctx.restore();
    }
}

// ===== MAIN GAME LOOP =====

/**
 * Main game loop using requestAnimationFrame for smooth 60fps gameplay
 * Handles all game updates and rendering in proper order
 */
function gameLoop() {
    if (!gameRunning) return; // Exit if game is not running

    const currentTime = Date.now();
    
    // Handle red ghost spawning on timer
    if (currentTime - lastRedGhostTime >= RED_GHOST_INTERVAL) {
        spawnEnemy(true); // Spawn red ghost
        lastRedGhostTime = currentTime;
    }

    // Update all game systems in order
    updateCat();              // Process player input
    updateOwner();            // Update AI movement
    spawnEnemy(false);        // Attempt to spawn regular enemies
    updateEnemies();          // Update enemy positions and collisions
    cleanupDistantEnemies();  // Remove far-away enemies
    updateCamera();           // Follow owner with camera
    draw();                   // Render everything

    // Schedule next frame
    requestAnimationFrame(gameLoop);
}

// ===== GAME STATE MANAGEMENT =====

/**
 * Restart game with fresh state
 * Resets all game variables and starts new game loop
 */
function restartGame() {
    gameRunning = true;
    score = 0;
    lives = 9;                    // Note: Different from initial lives (5)
    enemies = [];
    lastRedGhostTime = Date.now(); 
    
    // Hide UI screens
    startScreenElement.style.display = 'none';
    
    // Update UI displays
    scoreElement.textContent = score;
    highScoreElement.textContent = highScore;
    
    // Reset entity positions to center
    cat.x = WORLD_WIDTH / 2;
    cat.y = WORLD_HEIGHT / 2;
    owner.x = WORLD_WIDTH / 2 + 100;
    owner.y = WORLD_HEIGHT / 2 + 100;
    owner.direction = Math.random() * Math.PI * 2;
    owner.changeDirectionTimer = 0;

    // Update UI elements
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    gameOverElement.style.display = 'none';

    // Generate new world and start game loop
    createObstacles();
    gameLoop();
}

/**
 * Start new game from initial state
 * Used for first-time game start
 */
function startGame() {
    gameRunning = true;
    lastRedGhostTime = Date.now(); 
    startScreenElement.style.display = 'none';
    createObstacles();
    gameLoop();
}

// Initial draw call to render static world before game starts
draw();