/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(-0.5,1.5,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var vNormAttribLoc; // where to put norm for vertex shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var alphaULoc; // where to put alpha for fragment shader

/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

const ENEMY_COLS = 12;
const ENEMY_ROWS = 3;

// Starting position of the center of the enemies group,
const ENEMY_SCALE = 0.05, ENEMIES_CENTER_START = [0.5, 1.55, 0.95];
const PLAYER_SCALE = 0.07, PLAYER_START = [0.5, -0.6, 0.95];

// Side bounds are plus or minus.
const ENEMY_BACKFORTH_SPEED = 0.001, ENEMY_SIDE_BOUNDS = 0.4;
// Movement of the enemies group.
let enemiesMovingLeft = false;
let enemiesBackforthPosition = 0;

const PLAYER_SPEED = 0.005, PLAYER_SIDE_BOUNDS = 1.3;
var playerMovingLeft = false;
var playerMovingRight = false;
// If a player just pressed spacebar.
var playerMakeBullet = false;

// These variables give the average, and the evenly distributed random range around it.
// Time between enemies falling. 
const ENEMY_ATTACK_WAIT = 500, ENEMY_ATTACK_WAIT_RANGE = 500;
// enemyAttackTime is the current countdown to the next enemy falling.
let enemyAttackTime = ENEMY_ATTACK_WAIT + (Math.random() - 0.5) * ENEMY_ATTACK_WAIT_RANGE;

const ENEMY_FALL_SPEED = 0.005, ENEMY_BOTTOM_BOUND = -3;
// Amplitude of horizontal wobbling.
const ENEMY_FALL_AMPLITUDE = 0.3, ENEMY_FALL_AMPLITUDE_RANGE = 0.3;
// Frequency of horizontal wobbling. This is also multiplied by fall speed.
const ENEMY_FALL_FREQUENCY = 2, ENEMY_FALL_FREQUENCY_RANGE = 2;

// Size and rectangularity of player and enemy bullets.
const BULLET_SCALE = 0.01, BULLET_TALLNESS = 2;

const ENEMY_BULLET_SPEED = 0.02, ENEMY_BULLET_BOTTOM_BOUND = -1;
const ENEMY_LASER_DURATION = 100;
// How many bullet objects are available, invisible and intangible, to be teleported into place and used.
const ENEMY_BULLET_MAX_COUNT = 10;
// How many shots a single enemy is allowed to make, and how long it has to wait between shots.
const MAX_ENEMY_SHOTS = 3, ENEMY_SHOT_COOLDOWN = 100;

const PLAYER_BULLET_SPEED = 0.02, PLAYER_BULLET_TOP_BOUND = 2;
const PLAYER_LASER_DURATION = 100;

const basicMaterial = {
    alpha: 1,
    ambient: [0.1, 0.1, 0.1],
    diffuse: [0, 0, 0],
    n: 11,
    specular: [0.3, 0.3, 0.3],
}
const enemyMaterialA = {
    ...basicMaterial,
    ambient: [0.1, 0.1, 0.1],
}
const enemyMaterialB = {
    ...basicMaterial,
    ambient: [0.5, 0.5, 0.5],
}
const cubeVertices = [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
    [-1, 1, 1],
    [-1, 1, -1],
    [-1, -1, 1],
    [-1, -1, -1],
];
const rectangleVertices = cubeVertices.map((vertex) => [vertex[0], vertex[1] * BULLET_TALLNESS, vertex[2]]);
const laserVertices = cubeVertices.map((vertex) => [vertex[0], (vertex[1] + 1) * 1000, vertex[2]]);
const cuboidTriangles = [
    [0, 1, 5],
    [5, 4, 0],
    [0, 2, 3],
    [3, 1, 0],
    [0, 4, 6],
    [6, 2, 0],
    [1, 3, 7],
    [7, 5, 1],
    [2, 6, 7],
    [7, 3, 2],
    [4, 5, 7],
    [7, 6, 4],
];

function makeGameObjects() {
    
    // Make enemies
    for(let x = 0; x < ENEMY_COLS; x++)
        for(let y = 0; y < ENEMY_ROWS; y++) {
            // Make the rectangular grid
            const enemyOffset = [
                ENEMIES_CENTER_START[0] + ENEMY_SCALE*3 * (x - (ENEMY_COLS-1)/2),
                ENEMIES_CENTER_START[1] + ENEMY_SCALE*3 * (y - (ENEMY_ROWS-1)/2),
                ENEMIES_CENTER_START[2],
            ];
            inputTriangles.push({
                // Checkerboard of colors.
                material: (x + y) % 2 ? enemyMaterialA : enemyMaterialB,
                normals: cubeVertices,
                triangles: cuboidTriangles,
                vertices: cubeVertices.map((vertex) => {
                    const newVertex = [...vertex];
                    // Scale enemy
                    vec3.scale(newVertex, newVertex, ENEMY_SCALE);
                    // Translate enemy to starting position
                    vec3.add(newVertex, newVertex, enemyOffset);
                    return newVertex;
                }),
                isEnemy: true,
                offset: enemyOffset,
                shotsFired: 0,
                shotCooldown: 0,
            });
        }
    
    // Make player
    inputTriangles.push({
        material: {...basicMaterial, diffuse: [0, 0, 1]},
        normals: [...cubeVertices],
        triangles: [...cuboidTriangles],
        vertices: cubeVertices.map((vertex) => {
            const newVertex = [...vertex];
            // Scale player
            vec3.scale(newVertex, newVertex, PLAYER_SCALE);
            // Translate player to start position
            vec3.add(newVertex, newVertex, PLAYER_START);
            return newVertex;
        }),
        isPlayer: true,
    });
    
    for(let i = 0; i < ENEMY_BULLET_MAX_COUNT; i++) {
        // Make enemy bullets
        inputTriangles.push({
            material: {...basicMaterial, diffuse: [1, .7, 0], alpha: 0},
            normals: [...rectangleVertices],
            triangles: [...cuboidTriangles],
            vertices: rectangleVertices.map((vertex) => {
                const newVertex = [...vertex];
                // Scale bullet
                vec3.scale(newVertex, newVertex, BULLET_SCALE);
                return newVertex;
            }),
            isEnemyBullet: true,
        });
        // Make enemy lasers
        inputTriangles.push({
            material: {...basicMaterial, ambient: [1, .1, 0], alpha: 0},
            normals: [...laserVertices],
            triangles: [...cuboidTriangles],
            vertices: laserVertices.map((vertex) => {
                const newVertex = [...vertex];
                // Scale laser
                vec3.scale(newVertex, newVertex, BULLET_SCALE);
                return newVertex;
            }),
            isEnemyLaser: true,
        });
    }
    
    // Make player bullet
    inputTriangles.push({
        material: {...basicMaterial, diffuse: [1, .7, 0], alpha: 0},
        normals: [...rectangleVertices],
        triangles: [...cuboidTriangles],
        vertices: rectangleVertices.map((vertex) => {
            const newVertex = [...vertex];
            // Scale bullet
            vec3.scale(newVertex, newVertex, BULLET_SCALE);
            return newVertex;
        }),
        isPlayerBullet: true,
    });
    // Make player laser
    inputTriangles.push({
        material: {...basicMaterial, ambient: [1, 0.1, 0], alpha: 0},
        normals: [...laserVertices],
        triangles: [...cuboidTriangles],
        vertices: laserVertices.map((vertex) => {
            const newVertex = [...vertex];
            // Scale laser
            vec3.scale(newVertex, newVertex, BULLET_SCALE);
            return newVertex;
        }),
        isPlayerLaser: true,
    });
}

function moveGameObjects() {
    const player = inputTriangles.find((triangleSet) => triangleSet.isPlayer);
    const playerBullet = inputTriangles.find((triangleSet) => triangleSet.isPlayerBullet);
    const enemies = inputTriangles.filter((triangleSet) => triangleSet.isEnemy);
    const fallingEnemies = inputTriangles.filter((triangleSet) => triangleSet.isFallingEnemy);
    const enemyBullets = inputTriangles.filter((triangleSet) => triangleSet.isEnemyBullet);
    
    // Enemy backforth movement
    let swapDirection = false;
    if(enemiesMovingLeft) {
        enemiesBackforthPosition += ENEMY_BACKFORTH_SPEED;
        if(enemiesBackforthPosition >= ENEMY_SIDE_BOUNDS)
            swapDirection = true;
    } else {
        enemiesBackforthPosition -= ENEMY_BACKFORTH_SPEED;
        if(enemiesBackforthPosition <= -ENEMY_SIDE_BOUNDS)
            swapDirection = true;
    }
    enemies.forEach((enemy) => enemy.translation[0] = enemiesBackforthPosition);
    if(swapDirection) {
        enemiesMovingLeft = !enemiesMovingLeft;
        // Swap colors
        const temp = enemyMaterialA.ambient;
        enemyMaterialA.ambient = enemyMaterialB.ambient;
        enemyMaterialB.ambient = temp;
    }
    
    // Enemy starting an attack
    enemyAttackTime--;
    if(enemyAttackTime <= 0) {
        enemyAttackTime = ENEMY_ATTACK_WAIT + (Math.random() - 0.5) * ENEMY_ATTACK_WAIT_RANGE;
        if(enemies.length > 0) {
            const selectedEnemy = enemies[Math.floor(Math.random() * enemies.length)];
            selectedEnemy.isEnemy = false;
            selectedEnemy.isFallingEnemy = true;
            selectedEnemy.material = {...selectedEnemy.material, ambient: [0.3, 0.1, 0.1]};
            selectedEnemy.amplitude = ENEMY_FALL_AMPLITUDE + (Math.random() - 0.5) * ENEMY_FALL_AMPLITUDE_RANGE;
            selectedEnemy.frequency = ENEMY_FALL_FREQUENCY + (Math.random() - 0.5) * ENEMY_FALL_FREQUENCY_RANGE;
            selectedEnemy.phase = Math.random() * Math.PI * 2;
        }
    }

    fallingEnemies.forEach((enemy) => {
        
        // Flying enemy movement
        let horizontalMovement = 0;
        horizontalMovement -= Math.sin(enemy.translation[1] * enemy.frequency + enemy.phase) * enemy.amplitude;
        enemy.translation[1] -= ENEMY_FALL_SPEED;
        horizontalMovement += Math.sin(enemy.translation[1] * enemy.frequency + enemy.phase) * enemy.amplitude;
        enemy.translation[0] += horizontalMovement;
        
        // Deleting flying enemy when it goes down too far
        if(enemy.translation[1] <= ENEMY_BOTTOM_BOUND) {
            enemy.isFallingEnemy = false;
            enemy.material = {...enemy.material, alpha: 0};
        }
        
        // Flying enemy firing bullets
        if(enemy.offset[1] + enemy.translation[1] <= ENEMIES_CENTER_START[1] - ENEMY_SCALE*3 * (ENEMY_ROWS+1)/2) {
            enemy.shotCooldown--;
            if(enemy.shotCooldown < 0 && enemy.shotsFired < MAX_ENEMY_SHOTS) {
                const enemyBullet = enemyBullets.find((bullet) => !bullet.isFlying);
                if(enemyBullet) {
                    enemyBullet.isFlying = true;
                    enemyBullet.material.alpha = 1;
                    enemyBullet.translation = [...enemy.translation]
                    vec3.add(enemyBullet.translation, enemyBullet.translation, enemy.offset);
                    if(enemyBullet.isEnemyLaser) {
                        // Rotate laser to correct angle
                        vec3.normalize(enemyBullet.yAxis, [horizontalMovement, -ENEMY_FALL_SPEED, 0]);
                        enemyBullet.xAxis = [enemyBullet.yAxis[1], -enemyBullet.yAxis[0], 0];
                        enemyBullet.center = [0,0,0];
                        enemyBullet.laserCountdown = ENEMY_LASER_DURATION;

                        // Enemy laser and player collision detection
                        if(player) {
                            // It doesn't matter if left and right are backwards.
                            const playerLeftX = PLAYER_START[0] + player.translation[0] + PLAYER_SCALE;
                            const playerRightX = PLAYER_START[0] + player.translation[0] - PLAYER_SCALE;
                            const playerTopY = PLAYER_START[1] + player.translation[1] + PLAYER_SCALE;
                            const playerBotY = PLAYER_START[1] + player.translation[1] - PLAYER_SCALE;
                            const topLaserX = enemyBullet.translation[0] + (playerTopY - enemyBullet.translation[1]) / ENEMY_FALL_SPEED * horizontalMovement;
                            const botLaserX = enemyBullet.translation[0] + (playerBotY - enemyBullet.translation[1]) / ENEMY_FALL_SPEED * horizontalMovement;
                            let hit = false;
                            if(topLaserX >= playerRightX && topLaserX <= playerLeftX)
                                hit = true;
                            else if(botLaserX >= playerRightX && botLaserX <= playerLeftX)
                                hit = true;
                            else if((topLaserX >= playerRightX) != (botLaserX >= playerRightX))
                                hit = true;
                            if(hit) {
                                player.isPlayer = false;
                                player.material = {...player.material, alpha: 0};
                                // Does not delete the laser.
                            }
                        }
                    } else {
                        // Give bullet correct horizontal movement speed
                        enemyBullet.horizontalMovement = -horizontalMovement;
                    }
                    enemy.shotsFired++;
                    enemy.shotCooldown = ENEMY_SHOT_COOLDOWN;
                }
            }
        }
    });

    if(player) {
        
        // Player movement
        if(playerMovingLeft)
            player.translation[0] = Math.min(player.translation[0] + PLAYER_SPEED, PLAYER_SIDE_BOUNDS);
        if(playerMovingRight)
            player.translation[0] = Math.max(player.translation[0] - PLAYER_SPEED, -PLAYER_SIDE_BOUNDS);
        
        // Player firing bullets
        if(playerMakeBullet) {
            playerMakeBullet = false;
            if(!playerBullet.isFlying) {
                playerBullet.isFlying = true;
                playerBullet.material.alpha = 1;
                playerBullet.translation = [...player.translation];
                vec3.add(playerBullet.translation, playerBullet.translation, PLAYER_START);

                // Player laser and enemy collision detection
                if(playerBullet.isPlayerLaser) {
                    enemies.concat(fallingEnemies).forEach((target) => {
                        if(
                            Math.abs(
                                (target.offset[0] + target.translation[0]) -
                                (PLAYER_START[0] + player.translation[0])
                            ) <= ENEMY_SCALE
                        ) {
                            target.isEnemy = false;
                            target.isFallingEnemy = false;
                            target.material = {...target.material, alpha: 0};
                            // Does not delete the laser.
                        }
                    });
                    playerBullet.laserCountdown = PLAYER_LASER_DURATION;
                }
            }
        }
        
        // Player and enemy collision detection
        fallingEnemies.forEach((enemy) => {
            if([0,1,2].every((dim) =>
                Math.abs(
                    (enemy.offset[dim] + enemy.translation[dim]) -
                    (PLAYER_START[dim] + player.translation[dim])
                ) <= PLAYER_SCALE + ENEMY_SCALE
            )) {
                player.isPlayer = false;
                player.material = {...player.material, alpha: 0};
                enemy.isFallingEnemy = false;
                enemy.material = {...enemy.material, alpha: 0};
            }
        });
    }

    if(playerBullet.isFlying) {
        if(playerBullet.isPlayerLaser) {
            // Deleting player laser after a short time.
            if(--playerBullet.laserCountdown <= 0) {
                playerBullet.isFlying = false;
                playerBullet.material = {...playerBullet.material, alpha: 0};
            }
        } else {
            // Player bullet movement
            playerBullet.translation[1] += PLAYER_BULLET_SPEED;
    
            // Deleting player bullet when it goes up too far
            if(playerBullet.translation[1] >= PLAYER_BULLET_TOP_BOUND) {
                playerBullet.isFlying = false;
                playerBullet.material = {...playerBullet.material, alpha: 0};
            }
            
            // Player bullet and enemy collision detection
            enemies.concat(fallingEnemies).forEach((target) => {
                if([0,1,2].every((dim) =>
                    Math.abs(
                        (target.offset[dim] + target.translation[dim]) -
                        playerBullet.translation[dim]
                    ) <= BULLET_SCALE * (dim == 1 ? BULLET_TALLNESS : 1) + ENEMY_SCALE
                )) {
                    target.isEnemy = false;
                    target.isFallingEnemy = false;
                    target.material = {...target.material, alpha: 0};
                    playerBullet.isFlying = false;
                    playerBullet.material.alpha = 0;
                }
            });
        }
    }

    enemyBullets.forEach((enemyBullet) => {
        if(enemyBullet.isFlying) {
            if(enemyBullet.isEnemyLaser) {
                // Deleting enemy laser after a short time.
                if(--enemyBullet.laserCountdown <= 0) {
                    enemyBullet.isFlying = false;
                    enemyBullet.material = {...enemyBullet.material, alpha: 0};
                }
            } else {
                // Enemy bullet movement
                enemyBullet.translation[0] += enemyBullet.horizontalMovement/ENEMY_FALL_SPEED*ENEMY_BULLET_SPEED;
                enemyBullet.translation[1] -= ENEMY_BULLET_SPEED;
                
                // Deleting enemy bullet when it goes down too far
                if(enemyBullet.translation[1] <= ENEMY_BULLET_BOTTOM_BOUND) {
                    enemyBullet.isFlying = false;
                    enemyBullet.material = {...enemyBullet.material, alpha: 0};
                }
                
                // Enemy bullet and player collision detection
                if(player && [0,1,2].every((dim) =>
                    Math.abs(
                        (PLAYER_START[dim] + player.translation[dim]) -
                        enemyBullet.translation[dim]
                    ) <= BULLET_SCALE * (dim == 1 ? BULLET_TALLNESS : 1) + PLAYER_SCALE
                )) {
                    player.isPlayer = false;
                    player.material = {...player.material, alpha: 0};
                    enemyBullet.isFlying = false;
                    enemyBullet.material.alpha = 0;
                }
            }
        }
    });
}

// does stuff when keys are pressed
function handleKeyDown(event) {
    switch (event.code) {
        case "ArrowRight": // select next triangle set
            playerMovingRight = true;
            event.preventDefault();
            break;
        case "ArrowLeft": // select previous triangle set
            playerMovingLeft = true;
            event.preventDefault();
            break;
        case "Space": 
            playerMakeBullet = true;
            event.preventDefault();
            break;
        case "Digit1":
            if (event.getModifierState("Shift")) {
                inputTriangles.forEach((triangleSet) => {
                    if(triangleSet.isEnemyBullet) {
                        triangleSet.isEnemyBullet = false;
                        triangleSet.isFlying = false;
                        triangleSet.material = {...triangleSet.material, alpha: 0};
                    }
                    if(triangleSet.isPlayerBullet) {
                        triangleSet.isPlayerBullet = false;
                        triangleSet.isFlying = false;
                        triangleSet.material = {...triangleSet.material, alpha: 0};
                    }
                });
                inputTriangles.forEach((triangleSet) => {
                    if(triangleSet.isEnemyLaser)
                        triangleSet.isEnemyBullet = true;
                    if(triangleSet.isPlayerLaser)
                        triangleSet.isPlayerBullet = true;
                })
            }
            break;
    } // end switch
} // end handleKeyDown

function handleKeyUp(event) {
    switch (event.code) {
        case "ArrowLeft":
            playerMovingLeft = false;
            break;
        case "ArrowRight":
            playerMovingRight = false;
            break;
    } // end switch
} // end handleKeyUp

// set up the webGL environment
function setupWebGL() {
    
    // Set up keys
    document.onkeydown = handleKeyDown; // call this when key pressed
    document.onkeyup = handleKeyUp;

    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
      var cw = imageCanvas.width, ch = imageCanvas.height; 
      imageContext = imageCanvas.getContext("2d"); 
      var bkgdImage = new Image(); 
      bkgdImage.crossOrigin = "Anonymous";
      bkgdImage.src = "https://ncsucgclass.github.io/prog3/sky.jpg";
      bkgdImage.onload = function(){
          var iw = bkgdImage.width, ih = bkgdImage.height;
          imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);   
     }
     
    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {
    try {
        if (inputTriangles == String.null)
            throw "Unable to load triangles file!";
        else {
            var whichSetVert; // index of vertex in current triangle set
            var whichSetTri; // index of triangle in current triangle set
            var vtxToAdd; // vtx coords to add to the coord array
            var normToAdd; // vtx normal to add to the coord array
            var triToAdd; // tri indices to add to the index array
            var maxCorner = vec3.fromValues(Number.MIN_VALUE,Number.MIN_VALUE,Number.MIN_VALUE); // bbox corner
            var minCorner = vec3.fromValues(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE); // other corner
        
            // process each triangle set to load webgl vertex and triangle buffers
            numTriangleSets = inputTriangles.length; // remember how many tri sets
            for (var whichSet=0; whichSet<numTriangleSets; whichSet++) { // for each tri set
                
                // set up hilighting, modeling translation and rotation
                inputTriangles[whichSet].center = vec3.fromValues(0,0,0);  // center point of tri set
                inputTriangles[whichSet].on = false; // not highlighted
                inputTriangles[whichSet].translation = vec3.fromValues(0,0,0); // no translation
                inputTriangles[whichSet].xAxis = vec3.fromValues(1,0,0); // model X axis
                inputTriangles[whichSet].yAxis = vec3.fromValues(0,1,0); // model Y axis 

                // set up the vertex and normal arrays, define model center and axes
                inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
                inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
                var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
                for (whichSetVert=0; whichSetVert<numVerts; whichSetVert++) { // verts in set
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
                    normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
                    inputTriangles[whichSet].glVertices.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]); // put coords in set coord list
                    inputTriangles[whichSet].glNormals.push(normToAdd[0],normToAdd[1],normToAdd[2]); // put normal in set coord list
                    vec3.max(maxCorner,maxCorner,vtxToAdd); // update world bounding box corner maxima
                    vec3.min(minCorner,minCorner,vtxToAdd); // update world bounding box corner minima
                    vec3.add(inputTriangles[whichSet].center,inputTriangles[whichSet].center,vtxToAdd); // add to ctr sum
                } // end for vertices in set
                vec3.scale(inputTriangles[whichSet].center,inputTriangles[whichSet].center,1/numVerts); // avg ctr sum

                // send the vertex coords and normals to webGL
                vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glVertices),gl.STATIC_DRAW); // data in
                normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
                gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inputTriangles[whichSet].glNormals),gl.STATIC_DRAW); // data in
            
                // set up the triangle index array, adjusting indices across sets
                inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
                triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
                for (whichSetTri=0; whichSetTri<triSetSizes[whichSet]; whichSetTri++) {
                    triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
                    inputTriangles[whichSet].glTriangles.push(triToAdd[0],triToAdd[1],triToAdd[2]); // put indices in set list
                } // end for triangles in set

                // send the triangle indices to webGL
                triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(inputTriangles[whichSet].glTriangles),gl.STATIC_DRAW); // data in

            } // end for each triangle set 
        } // end if triangle file loaded
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
        
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix
        
        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader

        void main(void) {
            
            // vertex position
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z));
        }
    `;
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float; // set float to medium precision

        // eye location
        uniform vec3 uEyePosition; // the eye's position in world
        
        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position
        
        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
        uniform float uAlpha; // the transparency
        
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment
            
        void main(void) {
            // ambient term
            vec3 ambient = uAmbient*uLightAmbient; 
            
            // diffuse term
            vec3 normal = normalize(vVertexNormal); 
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term
            
            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term

            gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
            gl_FragColor *= uAlpha;
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                
                // locate and enable vertex attributes
                vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
                gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
                vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
                gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array
                
                // locate vertex uniforms
                mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
                pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat
                
                // locate fragment uniforms
                var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
                var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
                var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
                var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
                var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
                ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
                diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
                specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
                shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
                alphaULoc = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to alpha
                 
                // pass global constants into fragment uniforms
                gl.uniform3fv(eyePositionULoc,Eye); // pass in the eye's position
                gl.uniform3fv(lightAmbientULoc,lightAmbient); // pass in the light's ambient emission
                gl.uniform3fv(lightDiffuseULoc,lightDiffuse); // pass in the light's diffuse emission
                gl.uniform3fv(lightSpecularULoc,lightSpecular); // pass in the light's specular emission
                gl.uniform3fv(lightPositionULoc,lightPosition); // pass in the light's position
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    moveGameObjects();
    drawModels(true);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    drawModels(false);
    window.requestAnimationFrame(render); // set up frame render callback
}

function drawModels(opaque) {    
    
    // construct the model transform matrix, based on model state
    function makeModelTransform(currModel) {
        var zAxis = vec3.create(), sumRotation = mat4.create(), temp = mat4.create(), negCtr = vec3.create();

        // move the model to the origin
        mat4.fromTranslation(mMatrix,vec3.negate(negCtr,currModel.center)); 
        
        // scale for highlighting if needed
        if (currModel.on)
            mat4.multiply(mMatrix,mat4.fromScaling(temp,vec3.fromValues(1.2,1.2,1.2)),mMatrix); // S(1.2) * T(-ctr)
        
        // rotate the model to current interactive orientation
        vec3.normalize(zAxis,vec3.cross(zAxis,currModel.xAxis,currModel.yAxis)); // get the new model z axis
        mat4.set(sumRotation, // get the composite rotation
            currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
            currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
            currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
            0, 0,  0, 1);
        mat4.multiply(mMatrix,sumRotation,mMatrix); // R(ax) * S(1.2) * T(-ctr)
        
        // translate back to model center
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.center),mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

        // translate model to current interactive orientation
        mat4.multiply(mMatrix,mat4.fromTranslation(temp,currModel.translation),mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)
        
    } // end make model transform
    
    // var hMatrix = mat4.create(); // handedness matrix
    var pMatrix = mat4.create(); // projection matrix
    var vMatrix = mat4.create(); // view matrix
    var mMatrix = mat4.create(); // model matrix
    var pvMatrix = mat4.create(); // hand * proj * view matrices
    var pvmMatrix = mat4.create(); // hand * proj * view * model matrices
    
    // set up projection and view
    // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
    mat4.perspective(pMatrix,0.5*Math.PI,1,0.1,10); // create projection matrix
    mat4.lookAt(vMatrix,Eye,Center,Up); // create view matrix
    mat4.multiply(pvMatrix,pvMatrix,pMatrix); // projection
    mat4.multiply(pvMatrix,pvMatrix,vMatrix); // projection * view

    // render each triangle set
    var currSet; // the tri set and its material properties
    for (var whichTriSet=0; whichTriSet<numTriangleSets; whichTriSet++) {
        currSet = inputTriangles[whichTriSet];
        
        if(opaque !== (currSet.material.alpha >= 1))
            continue;
        
        // make model transform, add to view project
        makeModelTransform(currSet);
        mat4.multiply(pvmMatrix,pvMatrix,mMatrix); // project * view * model
        gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
        gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix
        
        // reflectivity: feed to the fragment shader
        gl.uniform3fv(ambientULoc,currSet.material.ambient); // pass in the ambient reflectivity
        gl.uniform3fv(diffuseULoc,currSet.material.diffuse); // pass in the diffuse reflectivity
        gl.uniform3fv(specularULoc,currSet.material.specular); // pass in the specular reflectivity
        gl.uniform1f(shininessULoc,currSet.material.n); // pass in the specular exponent
        gl.uniform1f(alphaULoc,currSet.material.alpha); // pass in the transparency
        
        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vPosAttribLoc,3,gl.FLOAT,false,0,0); // feed
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffers[whichTriSet]); // activate
        gl.vertexAttribPointer(vNormAttribLoc,3,gl.FLOAT,false,0,0); // feed

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffers[whichTriSet]); // activate
        gl.drawElements(gl.TRIANGLES,3*triSetSizes[whichTriSet],gl.UNSIGNED_SHORT,0); // render
    } // end for each triangle set
} // end render model

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  makeGameObjects();
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  render(); // draw the triangles using webGL
  
} // end main
