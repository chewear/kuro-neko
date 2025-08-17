// Initialize high score
if (localStorage.getItem('KuroNeko_HighScore') === null) {
    localStorage.setItem('KuroNeko_HighScore', '0');
}

// Game setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('scoreValue');
const highScoreElement = document.getElementById('highScoreValue');
const livesElement = document.getElementById('livesValue');
const gameOverElement = document.getElementById('gameOver');
const startScreenElement = document.getElementById('startScreen');
const finalScoreElement = document.getElementById('finalScore');

// Load sprites
const catSprite = new Image();
const ghostSprite = new Image();
const playerSprite = new Image();
ghostSprite.src = 'asset/ghost.png';
catSprite.src = 'asset/neko.png';
playerSprite.src = 'asset/player.png';

// Game constants
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const CANVAS_WIDTH = 800;  // Increased from 500
const CANVAS_HEIGHT = 600; // Increased from 400
const GRID_SIZE = 50;

// Game state
let gameRunning = false; // Start as false until player clicks start
let score = 0;
let highScore = parseInt(localStorage.getItem('KuroNeko_HighScore'));
let lives = 5;
let camera = { x: 0, y: 0 };

// Initialize high score display
highScoreElement.textContent = highScore;

// Game objects
let cat = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    radius: 15,
    speed: 3.5,
    facingLeft: false
};

let owner = {
    x: WORLD_WIDTH / 2 + 100,
    y: WORLD_HEIGHT / 2 + 100,
    radius: 12,
    speed: 0.8,
    direction: Math.random() * Math.PI * 2,
    changeDirectionTimer: 0,
    facingLeft: false
};

let enemies = [];
let obstacles = [];

// Input handling
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;
});
document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
});

// Initialize obstacles
function createObstacles() {
    obstacles = [];
    for (let i = 0; i < 20; i++) {
        obstacles.push({
            x: Math.random() * (WORLD_WIDTH - 100),
            y: Math.random() * (WORLD_HEIGHT - 100),
            width: 40 + Math.random() * 60,
            height: 40 + Math.random() * 60
        });
    }
}

// Collision detection
function circleCollision(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < obj1.radius + obj2.radius;
}

function circleRectCollision(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

// Check if position is valid (no obstacles)
function isValidPosition(obj, newX, newY) {
    const tempObj = { ...obj, x: newX, y: newY };
    for (let obstacle of obstacles) {
        if (circleRectCollision(tempObj, obstacle)) {
            return false;
        }
    }
    return newX >= obj.radius && newX <= WORLD_WIDTH - obj.radius && 
           newY >= obj.radius && newY <= WORLD_HEIGHT - obj.radius;
}

// Update cat position
function updateCat() {
    let newX = cat.x;
    let newY = cat.y;

    if (keys['w'] || keys['ArrowUp']) newY -= cat.speed;
    if (keys['s'] || keys['ArrowDown']) newY += cat.speed;
    if (keys['a'] || keys['ArrowLeft']) {
        newX -= cat.speed;
        cat.facingLeft = true;
    }
    if (keys['d'] || keys['ArrowRight']) {
        newX += cat.speed;
        cat.facingLeft = false;
    }

    if (isValidPosition(cat, newX, cat.y)) {
        cat.x = newX;
    }
    if (isValidPosition(cat, cat.x, newY)) {
        cat.y = newY;
    }
}

// Update owner AI
function updateOwner() {
    owner.changeDirectionTimer++;
    
    // Change direction occasionally
    if (owner.changeDirectionTimer > 120 + Math.random() * 240) {
        owner.direction = Math.random() * Math.PI * 2;
        owner.changeDirectionTimer = 0;
    }

    const moveX = Math.cos(owner.direction) * owner.speed;
    const newX = owner.x + moveX;
    const newY = owner.y + Math.sin(owner.direction) * owner.speed;

    if (isValidPosition(owner, newX, newY)) {
        owner.x = newX;
        owner.y = newY;
        // Update facing direction based on movement
        if (moveX !== 0) {
            owner.facingLeft = moveX < 0;
        }
    } else {
        // Change direction if hit obstacle
        owner.direction = Math.random() * Math.PI * 2;
    }
}

// Spawn enemies
function spawnEnemy() {
    if (Math.random() < 0.02) { // 2% chance per frame
        const side = Math.floor(Math.random() * 4);
        let x, y;

        switch (side) {
            case 0: // Top
                x = Math.random() * WORLD_WIDTH;
                y = 0;
                break;
            case 1: // Right
                x = WORLD_WIDTH;
                y = Math.random() * WORLD_HEIGHT;
                break;
            case 2: // Bottom
                x = Math.random() * WORLD_WIDTH;
                y = WORLD_HEIGHT;
                break;
            case 3: // Left
                x = 0;
                y = Math.random() * WORLD_HEIGHT;
                break;
        }

        enemies.push({
            x: x,
            y: y,
            radius: 10,
            speed: 1.2 + Math.random() * 0.8,
            facingRight: false // Will be updated in updateEnemies
        });
    }
}

// Update enemies
function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Move toward owner
        const dx = owner.x - enemy.x;
        const dy = owner.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const moveX = (dx / distance) * enemy.speed;
            enemy.x += moveX;
            enemy.y += (dy / distance) * enemy.speed;
            enemy.facingRight = moveX > 0; // Face right if moving right
        }

                // Check collision with cat
                if (circleCollision(enemy, cat)) {
                    enemies.splice(i, 1);
                    score += 1;
                    scoreElement.textContent = score;
                    if (score > highScore) {
                        highScore = score;
                        localStorage.setItem('KuroNeko_HighScore', highScore);
                        highScoreElement.textContent = highScore;
                    }
                    continue;
                }        // Check collision with owner
        if (circleCollision(enemy, owner)) {
            enemies.splice(i, 1);
            lives--;
            livesElement.textContent = lives;
            
            if (lives <= 0) {
                gameRunning = false;
                gameOverElement.style.display = 'block';
                finalScoreElement.textContent = score;
            }
            continue;
        }

        // Remove enemies that are too far away
        if (distance > WORLD_WIDTH) {
            enemies.splice(i, 1);
        }
    }
}

// Update camera to follow owner
function updateCamera() {
    camera.x = owner.x - CANVAS_WIDTH / 2;
    camera.y = owner.y - CANVAS_HEIGHT / 2;

    // Keep camera within world bounds
    camera.x = Math.max(0, Math.min(camera.x, WORLD_WIDTH - CANVAS_WIDTH));
    camera.y = Math.max(0, Math.min(camera.y, WORLD_HEIGHT - CANVAS_HEIGHT));
}

// Draw grid
function drawGrid() {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;

    const startX = Math.floor(camera.x / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(camera.y / GRID_SIZE) * GRID_SIZE;

    for (let x = startX; x < camera.x + CANVAS_WIDTH + GRID_SIZE; x += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x - camera.x, 0);
        ctx.lineTo(x - camera.x, CANVAS_HEIGHT);
        ctx.stroke();
    }

    for (let y = startY; y < camera.y + CANVAS_HEIGHT + GRID_SIZE; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y - camera.y);
        ctx.lineTo(CANVAS_WIDTH, y - camera.y);
        ctx.stroke();
    }
}

// Draw game objects
function draw() {
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    drawGrid();

    // Draw obstacles
    ctx.fillStyle = '#444';
    for (let obstacle of obstacles) {
        const screenX = obstacle.x - camera.x;
        const screenY = obstacle.y - camera.y;
        
        if (screenX + obstacle.width >= 0 && screenX <= CANVAS_WIDTH &&
            screenY + obstacle.height >= 0 && screenY <= CANVAS_HEIGHT) {
            ctx.fillRect(screenX, screenY, obstacle.width, obstacle.height);
        }
    }

    // Draw enemies
    for (let enemy of enemies) {
        const screenX = enemy.x - camera.x;
        const screenY = enemy.y - camera.y;
        
        if (screenX >= -enemy.radius && screenX <= CANVAS_WIDTH + enemy.radius &&
            screenY >= -enemy.radius && screenY <= CANVAS_HEIGHT + enemy.radius) {
            
            if (ghostSprite && ghostSprite.complete) {
                const spriteSize = enemy.radius * 3; // Make ghost similar size to cat
                ctx.save();
                if (!enemy.facingRight) { // Ghost faces left by default
                    ctx.drawImage(ghostSprite,
                        screenX - spriteSize/2,
                        screenY - spriteSize/2,
                        spriteSize,
                        spriteSize
                    );
                } else {
                    ctx.scale(-1, 1);
                    ctx.drawImage(ghostSprite,
                        -screenX - spriteSize/2,
                        screenY - spriteSize/2,
                        spriteSize,
                        spriteSize
                    );
                }
                ctx.restore();
            }
            
            // Add subtle glow effect
            ctx.shadowColor = '#ffffff44';
            ctx.shadowBlur = 15;
            ctx.shadowBlur = 0;
        }
    }

    // Draw owner
    const ownerScreenX = owner.x - camera.x;
    const ownerScreenY = owner.y - camera.y;
    if (playerSprite && playerSprite.complete) {
        const spriteSize = owner.radius * 8;
        ctx.save();
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

    // Draw cat sprite
    const catScreenX = cat.x - camera.x;
    const catScreenY = cat.y - camera.y;
    if (catSprite && catSprite.complete) {
        const spriteSize = cat.radius * 3;
        ctx.save();
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

// Game loop
function gameLoop() {
    if (!gameRunning) return;

    updateCat();
    updateOwner();
    spawnEnemy();
    updateEnemies();
    updateCamera();
    draw();

    requestAnimationFrame(gameLoop);
}

// Restart game
function restartGame() {
    gameRunning = true;
    score = 0;
    lives = 9;
    enemies = [];
    startScreenElement.style.display = 'none';
    
    // Update score displays
    scoreElement.textContent = score;
    highScoreElement.textContent = highScore;
    
    cat.x = WORLD_WIDTH / 2;
    cat.y = WORLD_HEIGHT / 2;
    owner.x = WORLD_WIDTH / 2 + 100;
    owner.y = WORLD_HEIGHT / 2 + 100;
    owner.direction = Math.random() * Math.PI * 2;
    owner.changeDirectionTimer = 0;

    scoreElement.textContent = score;
    livesElement.textContent = lives;
    gameOverElement.style.display = 'none';

    createObstacles();
    gameLoop();
}

// Start game function
function startGame() {
    gameRunning = true;
    startScreenElement.style.display = 'none';
    createObstacles();
    gameLoop();
}

// Initialize game (but don't start until player clicks)
draw(); // Draw initial state
