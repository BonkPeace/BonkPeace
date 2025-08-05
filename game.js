import * as THREE from 'three';

class GhibliSurvivors {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Game state
        this.gameTime = 0;
        this.health = 100;
        this.score = 0;
        this.gameRunning = false;
        this.isPaused = false;
        
        // Progressive difficulty
        this.baseSpawnInterval = 2000; // Base spawn interval in milliseconds
        this.baseEnemySpeed = 2; // Base enemy speed
        this.lastDifficultyUpdate = 0; // Track when difficulty was last updated
        this.lastGiantSpawn = 0; // Track when last giant was spawned
        
        // Player
        this.player = {
            position: new THREE.Vector3(0, 1.7, 0), // Will be adjusted to terrain height
            velocity: new THREE.Vector3(),
            speed: 5,
            rotation: new THREE.Euler(),
            onGround: true
        };
        
        // Controls
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.mouseSpeed = 0.002;
        
        // Game objects
        this.enemies = [];
        this.bullets = [];
        this.terrain = null;
        
        // Air wall boundaries (half the terrain size)
        this.worldBounds = {
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50
        };
        
        // Particle systems
        this.particles = [];
        this.fireflies = [];
        this.muzzleFlashes = [];
        this.dustParticles = [];
        
        // Audio system
        this.audioContext = null;
        this.sounds = {};
        this.musicGain = null;
        this.sfxGain = null;
        this.backgroundMusic = null;
        
        this.init();
        this.setupPlayAgainButton();
    }
    
    init() {
        this.setupScene();
        this.setupControls();
        this.createEnvironment();
        this.createParticleSystems();
        this.setupAudio();
        this.startGame();
        this.animate();
    }
    
    setupPlayAgainButton() {
        const playAgainBtn = document.getElementById('playAgainBtn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }
    }
    
    restartGame() {
        // Hide game over UI
        document.getElementById('gameOverUI').style.display = 'none';
        
        // Clear all existing game objects
        this.clearGameObjects();
        
        // Reset game state
        this.gameTime = 0;
        this.health = 100;
        this.score = 0;
        this.gameRunning = false;
        this.isPaused = false;
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.muzzleFlashes = [];
        
        // Reset player position
        this.player.position.set(0, 1.7, 0);
        this.mouse.x = 0;
        this.mouse.y = 0;
        
        // Position player properly on terrain
        this.positionPlayerOnTerrain();
        
        // Update camera
        this.camera.position.copy(this.player.position);
        this.camera.rotation.set(0, 0, 0);
        
        // Update player light
        if (this.playerLight) {
            this.playerLight.position.copy(this.player.position);
            this.playerLight.position.y += 0.5;
            const direction = new THREE.Vector3(0, 0, -1);
            this.playerLight.target.position.copy(this.player.position).add(direction.multiplyScalar(10));
        }
        
        // Start new game
        this.startGame();
        
        // Request pointer lock for new game
        this.renderer.domElement.requestPointerLock();
    }
    
    clearGameObjects() {
        // Remove all enemies
        this.enemies.forEach(enemy => {
            this.scene.remove(enemy);
        });
        
        // Remove all bullets  
        this.bullets.forEach(bullet => {
            this.scene.remove(bullet);
        });
        
        // Remove all particles
        this.particles.forEach(particle => {
            this.scene.remove(particle);
        });
        
        // Remove all muzzle flashes
        this.muzzleFlashes.forEach(flash => {
            this.scene.remove(flash);
        });
    }
    
    setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000020, 10, 50); // Restored to previous range
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.copy(this.player.position);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000011); // Very dark night sky
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        // Nighttime lighting setup
        // Very dim ambient light to simulate moonlight
        const ambientLight = new THREE.AmbientLight(0x202040, 0.1);
        this.scene.add(ambientLight);
        
        // Weak moonlight from above
        const moonLight = new THREE.DirectionalLight(0x404080, 0.2);
        moonLight.position.set(0, 100, 0);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.width = 1024;
        moonLight.shadow.mapSize.height = 1024;
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 100;
        moonLight.shadow.camera.left = -50;
        moonLight.shadow.camera.right = 50;
        moonLight.shadow.camera.top = 50;
        moonLight.shadow.camera.bottom = -50;
        this.scene.add(moonLight);
        
        // Player's flashlight/lantern (restored range)
        this.playerLight = new THREE.SpotLight(0xffffff, 2.0, 20, Math.PI / 5, 0.4); // Restored range from 10 to 20
        this.playerLight.position.copy(this.player.position);
        this.playerLight.target.position.set(0, 0, -1);
        this.playerLight.castShadow = true;
        this.playerLight.shadow.mapSize.width = 1024;
        this.playerLight.shadow.mapSize.height = 1024;
        this.scene.add(this.playerLight);
        this.scene.add(this.playerLight.target);
        
        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            if (event.code === 'Escape') {
                this.togglePause();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Mouse controls
        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.mouse.x += event.movementX * this.mouseSpeed;
                this.mouse.y += event.movementY * this.mouseSpeed;
                this.mouse.y = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.mouse.y));
            }
        });
        
        document.addEventListener('click', () => {
            // Resume audio context on first user interaction
            this.resumeAudioContext();
            
            if (document.pointerLockElement !== this.renderer.domElement) {
                this.renderer.domElement.requestPointerLock();
            } else {
                this.shoot();
            }
        });
        
        // Pointer lock change
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.gameRunning = true;
            }
        });
        
        // Audio volume controls
        this.setupAudioControls();
    }
    
    setupAudioControls() {
        const masterVolumeSlider = document.getElementById('masterVolume');
        const musicVolumeSlider = document.getElementById('musicVolume');
        const sfxVolumeSlider = document.getElementById('sfxVolume');
        
        if (masterVolumeSlider) {
            masterVolumeSlider.addEventListener('input', (e) => {
                if (this.masterGain) {
                    this.masterGain.gain.value = e.target.value / 100;
                }
            });
        }
        
        if (musicVolumeSlider) {
            musicVolumeSlider.addEventListener('input', (e) => {
                if (this.musicGain) {
                    this.musicGain.gain.value = e.target.value / 100;
                }
            });
        }
        
        if (sfxVolumeSlider) {
            sfxVolumeSlider.addEventListener('input', (e) => {
                if (this.sfxGain) {
                    this.sfxGain.gain.value = e.target.value / 100;
                }
            });
        }
    }
    
    createEnvironment() {
        // Create diverse terrain with multiple biomes
        this.createDiverseTerrain();
        
        // Add lots of vegetation for Ghibli atmosphere
        this.createTrees();
        this.createFlowers();
        this.createGrassPatches();
        this.createBushes();
        this.createRocks();
        
        // Enhanced sky with gradient and clouds
        this.createSkyAndClouds();
        
        // Create visible air walls
        this.createAirWalls();
        
        // Position player properly on terrain
        this.positionPlayerOnTerrain();
    }
    
    createDiverseTerrain() {
        const terrainSize = 100; // Restored to previous size
        const terrainResolution = 32; // Restored resolution
        const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainResolution, terrainResolution);
        
        const vertices = terrainGeometry.attributes.position.array;
        
        // Generate height map with plains and hills
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Normalize coordinates for noise functions
            const nx = x / terrainSize;
            const nz = z / terrainSize;
            
            // Create gentle rolling hills
            let height = 0;
            height += Math.sin(nx * 3) * Math.cos(nz * 3) * 2;  // Large rolling hills
            height += Math.sin(nx * 6) * Math.cos(nz * 6) * 1;  // Medium hills
            height += Math.sin(nx * 12) * Math.cos(nz * 12) * 0.3; // Small variations
            
            // Create some flat plains areas
            const plainNoise = Math.sin(nx * 4) * Math.cos(nz * 4);
            if (Math.abs(plainNoise) < 0.3) {
                height *= 0.2; // Flatten for plains
            }
            
            vertices[i + 1] = height;
        }
        
        terrainGeometry.attributes.position.needsUpdate = true;
        terrainGeometry.computeVertexNormals();
        
        // Black terrain material for night environment
        const terrainMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x000000, // Black ground
            wireframe: false
        });
        
        this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
    }
    
    createSkyAndClouds() {
        // Create night sky
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: {
                topColor: { value: new THREE.Color(0x000033) }, // Very dark blue
                bottomColor: { value: new THREE.Color(0x000011) }, // Almost black
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        
        // Add stars instead of clouds for night atmosphere
        this.createStars();
    }
    
    createStars() {
        const starGroup = new THREE.Group();
        
        // Create many small stars scattered in the night sky
        for (let i = 0; i < 100; i++) {
            const starGeometry = new THREE.SphereGeometry(0.5, 4, 4);
            const starMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.8 + Math.random() * 0.2
            });
            
            const star = new THREE.Mesh(starGeometry, starMaterial);
            
            // Position stars randomly in a sphere around the world
            const radius = 400 + Math.random() * 100;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 0.5 + 0.5); // Bias towards upper hemisphere
            
            star.position.set(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
            
            starGroup.add(star);
        }
        
        this.scene.add(starGroup);
        this.starGroup = starGroup;
    }
    
    createAirWalls() {
        // Create visible air walls at the boundaries
        const wallHeight = 8;
        const wallThickness = 0.2;
        const wallMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x404080,
            transparent: true,
            opacity: 0.3
        });
        
        // North wall (positive Z)
        const northWall = new THREE.BoxGeometry(100, wallHeight, wallThickness);
        const northWallMesh = new THREE.Mesh(northWall, wallMaterial);
        northWallMesh.position.set(0, wallHeight/2, this.worldBounds.maxZ);
        this.scene.add(northWallMesh);
        
        // South wall (negative Z)  
        const southWall = new THREE.BoxGeometry(100, wallHeight, wallThickness);
        const southWallMesh = new THREE.Mesh(southWall, wallMaterial);
        southWallMesh.position.set(0, wallHeight/2, this.worldBounds.minZ);
        this.scene.add(southWallMesh);
        
        // East wall (positive X)
        const eastWall = new THREE.BoxGeometry(wallThickness, wallHeight, 100);
        const eastWallMesh = new THREE.Mesh(eastWall, wallMaterial);
        eastWallMesh.position.set(this.worldBounds.maxX, wallHeight/2, 0);
        this.scene.add(eastWallMesh);
        
        // West wall (negative X)
        const westWall = new THREE.BoxGeometry(wallThickness, wallHeight, 100);
        const westWallMesh = new THREE.Mesh(westWall, wallMaterial);
        westWallMesh.position.set(this.worldBounds.minX, wallHeight/2, 0);
        this.scene.add(westWallMesh);
    }
    
    positionPlayerOnTerrain() {
        // Position player properly on the terrain surface
        const terrainHeight = this.getTerrainHeight(this.player.position.x, this.player.position.z);
        this.player.position.y = terrainHeight + 1.7; // Player height above ground
        this.camera.position.copy(this.player.position);
    }
    
    createParticleSystems() {
        this.createFireflies();
        this.createFloatingDust();
    }
    
    createFireflies() {
        // Add magical fireflies floating around the dark environment
        for (let i = 0; i < 50; i++) { // Restored count
            const fireflyGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const fireflyMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xFFFF88,
                transparent: true,
                opacity: 0.8
            });
            
            const firefly = new THREE.Mesh(fireflyGeometry, fireflyMaterial);
            
            // Random position around the world - restored range
            firefly.position.set(
                (Math.random() - 0.5) * 80, // Restored from 20 to 80
                1 + Math.random() * 5,
                (Math.random() - 0.5) * 80  // Restored from 20 to 80
            );
            
            // Add movement properties
            firefly.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 2
            );
            firefly.startPosition = firefly.position.clone();
            firefly.time = Math.random() * Math.PI * 2;
            
            this.fireflies.push(firefly);
            this.scene.add(firefly);
        }
    }
    
    createFloatingDust() {
        // Add atmospheric dust particles that float in the air
        for (let i = 0; i < 200; i++) { // Restored from 50 to 200
            const dustGeometry = new THREE.SphereGeometry(0.02, 4, 4);
            const dustMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.3
            });
            
            const dust = new THREE.Mesh(dustGeometry, dustMaterial);
            
            dust.position.set(
                (Math.random() - 0.5) * 100, // Restored from 25 to 100
                Math.random() * 8,
                (Math.random() - 0.5) * 100  // Restored from 25 to 100
            );
            
            dust.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.5
            );
            
            this.dustParticles.push(dust);
            this.scene.add(dust);
        }
    }
    
    createMuzzleFlash(position) {
        // Create muzzle flash particle effect when shooting
        const flashGroup = new THREE.Group();
        
        // Main flash
        const flashGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFAA00,
            transparent: true,
            opacity: 1.0
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        flashGroup.add(flash);
        
        // Spark particles
        for (let i = 0; i < 10; i++) {
            const sparkGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFFFF00 : 0xFF6600,
                transparent: true,
                opacity: 1.0
            });
            
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            spark.position.copy(position);
            
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            spark.velocity = direction.multiplyScalar(5 + Math.random() * 10);
            spark.life = 0.2 + Math.random() * 0.3;
            spark.maxLife = spark.life;
            
            flashGroup.add(spark);
        }
        
        flashGroup.life = 0.1;
        flashGroup.maxLife = flashGroup.life;
        
        this.muzzleFlashes.push(flashGroup);
        this.scene.add(flashGroup);
    }
    
    createHitEffect(position) {
        // Create particle effect when bullet hits enemy
        for (let i = 0; i < 15; i++) {
            const hitGeometry = new THREE.SphereGeometry(0.08, 4, 4);
            const hitMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xFF4444 : 0xFF8888,
                transparent: true,
                opacity: 1.0
            });
            
            const particle = new THREE.Mesh(hitGeometry, hitMaterial);
            particle.position.copy(position);
            
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            particle.velocity = direction.multiplyScalar(3 + Math.random() * 7);
            particle.life = 0.5 + Math.random() * 0.5;
            particle.maxLife = particle.life;
            particle.gravity = -9.8;
            
            this.particles.push(particle);
            this.scene.add(particle);
        }
    }
    
    createDeathExplosion(position) {
        // Create explosion effect when enemy dies
        for (let i = 0; i < 25; i++) {
            const explosionGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const explosionMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random() * 0.1, 1.0, 0.5),
                transparent: true,
                opacity: 1.0
            });
            
            const particle = new THREE.Mesh(explosionGeometry, explosionMaterial);
            particle.position.copy(position);
            
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            ).normalize();
            
            particle.velocity = direction.multiplyScalar(8 + Math.random() * 12);
            particle.life = 0.8 + Math.random() * 0.7;
            particle.maxLife = particle.life;
            particle.gravity = -4.9;
            
            this.particles.push(particle);
            this.scene.add(particle);
        }
    }
    
    createFootstepDust(position) {
        // Create small dust puffs when moving
        if (Math.random() < 0.3) { // Only sometimes to avoid too many particles
            for (let i = 0; i < 3; i++) {
                const dustGeometry = new THREE.SphereGeometry(0.05, 4, 4);
                const dustMaterial = new THREE.MeshBasicMaterial({
                    color: 0x333333,
                    transparent: true,
                    opacity: 0.4
                });
                
                const dust = new THREE.Mesh(dustGeometry, dustMaterial);
                dust.position.copy(position);
                dust.position.y = 0.1;
                dust.position.x += (Math.random() - 0.5) * 0.5;
                dust.position.z += (Math.random() - 0.5) * 0.5;
                
                dust.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    0.5 + Math.random() * 1,
                    (Math.random() - 0.5) * 1
                );
                dust.life = 0.5 + Math.random() * 0.3;
                dust.maxLife = dust.life;
                dust.gravity = -2;
                
                this.particles.push(dust);
                this.scene.add(dust);
            }
        }
    }
    
    updateParticles(deltaTime) {
        // Update fireflies with smooth floating movement
        this.fireflies.forEach((firefly, index) => {
            firefly.time += deltaTime;
            
            // Smooth floating movement
            firefly.position.add(firefly.velocity.clone().multiplyScalar(deltaTime));
            firefly.position.y = firefly.startPosition.y + Math.sin(firefly.time) * 2;
            
            // Gentle pulsing glow
            firefly.material.opacity = 0.6 + 0.4 * Math.sin(firefly.time * 3);
            
            // Boundary checking - wrap around (restored boundaries)
            if (firefly.position.x > 50) firefly.position.x = -50; // Restored from 12.5 to 50
            if (firefly.position.x < -50) firefly.position.x = 50;
            if (firefly.position.z > 50) firefly.position.z = -50;
            if (firefly.position.z < -50) firefly.position.z = 50;
        });
        
        // Update floating dust
        this.dustParticles.forEach((dust, index) => {
            dust.position.add(dust.velocity.clone().multiplyScalar(deltaTime));
            
            // Boundary checking for dust (restored boundaries)
            if (dust.position.y > 10) dust.position.y = 0;
            if (dust.position.x > 60) dust.position.x = -60; // Restored from 15 to 60
            if (dust.position.x < -60) dust.position.x = 60;
            if (dust.position.z > 60) dust.position.z = -60;
            if (dust.position.z < -60) dust.position.z = 60;
        });
        
        // Update general particles (hit effects, explosions, footstep dust)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Apply velocity and gravity
            particle.velocity.y += (particle.gravity || 0) * deltaTime;
            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
            
            // Update life and opacity
            particle.life -= deltaTime;
            particle.material.opacity = particle.life / particle.maxLife;
            particle.scale.setScalar(1 - (1 - particle.life / particle.maxLife) * 0.5);
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.scene.remove(particle);
                this.particles.splice(i, 1);
            }
        }
        
        // Update muzzle flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            const flash = this.muzzleFlashes[i];
            flash.life -= deltaTime;
            
            // Fade out flash
            flash.children.forEach(child => {
                if (child.velocity) {
                    child.position.add(child.velocity.clone().multiplyScalar(deltaTime));
                    child.velocity.multiplyScalar(0.95); // Slow down sparks
                }
                child.material.opacity = flash.life / flash.maxLife;
            });
            
            // Remove expired flashes
            if (flash.life <= 0) {
                this.scene.remove(flash);
                this.muzzleFlashes.splice(i, 1);
            }
        }
    }
    
    setupAudio() {
        try {
            // Initialize Web Audio API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create master gain nodes
            this.masterGain = this.audioContext.createGain();
            this.musicGain = this.audioContext.createGain();
            this.sfxGain = this.audioContext.createGain();
            
            // Connect gain nodes
            this.musicGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.audioContext.destination);
            
            // Set initial volumes
            this.masterGain.gain.value = 0.7;
            this.musicGain.gain.value = 0.3;
            this.sfxGain.gain.value = 0.6;
            
            // Generate procedural sounds
            this.generateSounds();
            
            console.log('Audio system initialized');
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }
    
    generateSounds() {
        // Generate gunshot sound
        this.sounds.gunshot = this.createGunshot();
        
        // Generate hit sound
        this.sounds.hit = this.createHit();
        
        // Generate explosion sound
        this.sounds.explosion = this.createExplosion();
        
        // Generate footstep sound
        this.sounds.footstep = this.createFootstep();
        
        // Generate enemy death sound
        this.sounds.enemyDeath = this.createEnemyDeath();
        
        // Generate pickup sound
        this.sounds.pickup = this.createPickup();
        
        // Start background music
        this.startBackgroundMusic();
    }
    
    createGunshot() {
        const length = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, length * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            let sample = 0;
            
            // AK47-style gunshot characteristics
            if (t < 0.001) {
                // Instantaneous muzzle blast - very sharp attack
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 500) * 0.95 +
                        Math.sin(t * 3000 * Math.PI) * Math.exp(-t * 400) * 0.7;
            } else if (t < 0.005) {
                // Initial explosion with characteristic AK crack
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 200) * 0.8 +
                        Math.sin(t * 1500 * Math.PI) * Math.exp(-t * 180) * 0.6 +
                        Math.sin(t * 800 * Math.PI) * Math.exp(-t * 150) * 0.4;
            } else if (t < 0.02) {
                // Gas expansion and mechanical action
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.6 +
                        Math.sin(t * 600 * Math.PI) * Math.exp(-t * 60) * 0.4 +
                        Math.sin(t * 300 * Math.PI) * Math.exp(-t * 40) * 0.3;
            } else if (t < 0.08) {
                // Echo and acoustic reflection
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 25) * 0.3 +
                        Math.sin(t * 200 * Math.PI) * Math.exp(-t * 20) * 0.2 +
                        Math.sin(t * 100 * Math.PI) * Math.exp(-t * 15) * 0.15;
            } else {
                // Long tail with environmental reverb
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.12 +
                        Math.sin(t * 60 * Math.PI) * Math.exp(-t * 6) * 0.08 +
                        Math.sin(t * 30 * Math.PI) * Math.exp(-t * 4) * 0.05;
            }
            
            data[i] = sample;
        }
        
        return buffer;
    }
    
    createHit() {
        const length = 0.3;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, length * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            let sample = 0;
            
            // Wet impact sound with splatter
            if (t < 0.01) {
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 120) * 0.6 +
                        Math.sin(t * 600 * Math.PI) * Math.exp(-t * 100) * 0.4;
            } else if (t < 0.05) {
                // Flesh impact with liquid sound
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.4 +
                        Math.sin(t * 300 * Math.PI) * Math.exp(-t * 25) * 0.3 +
                        Math.sin(t * 150 * Math.PI) * Math.exp(-t * 20) * 0.2;
            } else {
                // Dripping/settling sound
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.2 +
                        Math.sin(t * 80 * Math.PI) * Math.exp(-t * 8) * 0.15;
            }
            
            data[i] = sample;
        }
        
        return buffer;
    }
    
    createExplosion() {
        const length = 1.0;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, length * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            let sample = 0;
            
            // Initial boom
            if (t < 0.1) {
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 10) * 0.8;
            } else {
                // Rumbling decay
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 2) * 0.3 +
                        Math.sin(t * 60 * Math.PI) * Math.exp(-t * 3) * 0.2;
            }
            
            data[i] = sample;
        }
        
        return buffer;
    }
    
    createFootstep() {
        const length = 0.25;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, length * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            let sample = 0;
            
            // Initial impact - sharp thud
            if (t < 0.02) {
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 80) * 0.4 +
                        Math.sin(t * 80 * Math.PI) * Math.exp(-t * 60) * 0.3;
            } else if (t < 0.08) {
                // Dirt/gravel shifting sound
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.25 +
                        Math.sin(t * 40 * Math.PI) * Math.exp(-t * 20) * 0.15;
            } else {
                // Subtle echo and settling
                sample = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.1 +
                        Math.sin(t * 20 * Math.PI) * Math.exp(-t * 10) * 0.08;
            }
            
            data[i] = sample;
        }
        
        return buffer;
    }
    
    createEnemyDeath() {
        const length = 0.8;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, length * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            // Descending mechanical sound
            const freq = 400 * Math.exp(-t * 2);
            const sample = Math.sin(t * freq * Math.PI) * Math.exp(-t * 3) * 0.4 +
                          (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.2;
            data[i] = sample;
        }
        
        return buffer;
    }
    
    createPickup() {
        const length = 0.3;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, length * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            // Ascending chime
            const freq = 440 + t * 880;
            const sample = Math.sin(t * freq * Math.PI) * Math.exp(-t * 5) * 0.3;
            data[i] = sample;
        }
        
        return buffer;
    }
    
    startBackgroundMusic() {
        if (!this.audioContext) return;
        
        // Create ambient background music using oscillators
        this.createAmbientMusic();
    }
    
    createAmbientMusic() {
        // Create horror movie-style tension music with original composition
        this.createPsychologicalTensionTheme();
        this.createDeepUnsettlingDrones();
        this.createDiscordantOrchestralElements();
        
        // Add unsettling ambient layers
        this.createOminousWind();
        
        // Add psychological horror elements
        this.createReversePianoNotes();
        this.createBuildingTensionSweeps();
        
        // Schedule terrifying sound events
        this.scheduleHorrorSounds();
    }
    
    createAmbientLayer(frequency, volume, waveType) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.type = waveType;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(frequency * 2, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 3);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        oscillator.start();
        
        // Add subtle frequency modulation
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.1 + Math.random() * 0.2, this.audioContext.currentTime);
        lfoGain.gain.setValueAtTime(frequency * 0.02, this.audioContext.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        lfo.start();
    }
    
    createDarkDrone(frequency, volume, waveType) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.type = waveType;
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        // Dark, filtered sound
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(frequency * 1.5, this.audioContext.currentTime);
        filter.Q.setValueAtTime(2, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 5);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        oscillator.start();
        
        // Add menacing frequency modulation
        const lfo = this.audioContext.createOscillator();
        const lfoGain = this.audioContext.createGain();
        
        lfo.type = 'triangle';
        lfo.frequency.setValueAtTime(0.05 + Math.random() * 0.1, this.audioContext.currentTime);
        lfoGain.gain.setValueAtTime(frequency * 0.03, this.audioContext.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        lfo.start();
    }
    
    createWindSound() {
        // Create wind using filtered noise
        const bufferSize = this.audioContext.sampleRate * 10; // 10 seconds of wind
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.1;
        }
        
        const windSource = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gainNode = this.audioContext.createGain();
        
        windSource.buffer = buffer;
        windSource.loop = true;
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, this.audioContext.currentTime);
        filter.Q.setValueAtTime(0.5, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.03, this.audioContext.currentTime);
        
        windSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        windSource.start();
    }
    
    scheduleNightSounds() {
        const playNightSound = () => {
            if (Math.random() < 0.3) {
                this.playOwlHoot();
            } else if (Math.random() < 0.5) {
                this.playCrickets();
            }
            
            // Schedule next sound
            setTimeout(playNightSound, 15000 + Math.random() * 30000); // 15-45 seconds
        };
        
        // Start after 10 seconds
        setTimeout(playNightSound, 10000);
    }
    
    playOwlHoot() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
        
        const now = this.audioContext.currentTime;
        
        // Two-note hoot
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.setValueAtTime(300, now + 0.3);
        oscillator.frequency.setValueAtTime(300, now + 0.6);
        oscillator.frequency.setValueAtTime(250, now + 0.9);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0.05, now + 0.3);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.6);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.2);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        oscillator.start(now);
        oscillator.stop(now + 1.2);
    }
    
    playCrickets() {
        if (!this.audioContext) return;
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(2000 + Math.random() * 1000, this.audioContext.currentTime);
                
                const now = this.audioContext.currentTime;
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.02, now + 0.01);
                gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
                
                oscillator.connect(gainNode);
                gainNode.connect(this.musicGain);
                
                oscillator.start(now);
                oscillator.stop(now + 0.1);
            }, i * 100 + Math.random() * 200);
        }
    }
    
    createDissonantLayer(frequency, volume, waveType) {
        // Create slightly detuned oscillators for dissonance
        for (let i = 0; i < 3; i++) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            // Slight detuning creates unsettling dissonance
            const detune = (i - 1) * 7; // -7, 0, +7 cents
            oscillator.type = waveType;
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.detune.setValueAtTime(detune, this.audioContext.currentTime);
            
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(frequency * 2, this.audioContext.currentTime);
            filter.Q.setValueAtTime(0.8, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume / 3, this.audioContext.currentTime + 4);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.musicGain);
            
            oscillator.start();
        }
    }
    
    createOminousWind() {
        // Create unsettling wind using filtered noise with automation
        const bufferSize = this.audioContext.sampleRate * 15; // 15 seconds of wind
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.15;
        }
        
        const windSource = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gainNode = this.audioContext.createGain();
        
        windSource.buffer = buffer;
        windSource.loop = true;
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(180, this.audioContext.currentTime);
        filter.Q.setValueAtTime(0.3, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.04, this.audioContext.currentTime);
        
        windSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        windSource.start();
        
        // Add automation for tension building
        setInterval(() => {
            if (this.audioContext) {
                const now = this.audioContext.currentTime;
                const intensity = 0.04 + Math.random() * 0.02;
                gainNode.gain.linearRampToValueAtTime(intensity, now + 2);
                
                const filterFreq = 180 + Math.random() * 100;
                filter.frequency.linearRampToValueAtTime(filterFreq, now + 3);
            }
        }, 8000);
    }
    
    createTensionPulse() {
        // Create subtle rhythmic pulses that build tension
        const pulse = () => {
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(40 + Math.random() * 20, this.audioContext.currentTime);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(100, this.audioContext.currentTime);
            
            const now = this.audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.02, now + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.musicGain);
            
            oscillator.start(now);
            oscillator.stop(now + 0.8);
            
            // Schedule next pulse with irregular timing for unease
            setTimeout(pulse, 3000 + Math.random() * 4000);
        };
        
        // Start first pulse after 5 seconds
        setTimeout(pulse, 5000);
    }
    
    scheduleHorrorSounds() {
        const playHorrorSound = () => {
            const rand = Math.random();
            if (rand < 0.3) {
                this.playDistantScream();
            } else if (rand < 0.6) {
                this.playMetallicClang();
            } else if (rand < 0.8) {
                this.playWhisper();
            } else {
                this.playCreepyChimes();
            }
            
            // Schedule next horror sound with long, irregular intervals
            setTimeout(playHorrorSound, 20000 + Math.random() * 40000); // 20-60 seconds
        };
        
        // Start after 15 seconds
        setTimeout(playHorrorSound, 15000);
    }
    
    playDistantScream() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.type = 'sawtooth';
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, this.audioContext.currentTime);
        filter.Q.setValueAtTime(3, this.audioContext.currentTime);
        
        const now = this.audioContext.currentTime;
        
        // Distant scream frequency modulation
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.linearRampToValueAtTime(800, now + 0.3);
        oscillator.frequency.linearRampToValueAtTime(300, now + 1.2);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.2);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.5);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        oscillator.start(now);
        oscillator.stop(now + 1.5);
    }
    
    playMetallicClang() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(200 + Math.random() * 100, this.audioContext.currentTime);
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(150, this.audioContext.currentTime);
        
        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.06, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2);
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        oscillator.start(now);
        oscillator.stop(now + 2);
    }
    
    playWhisper() {
        if (!this.audioContext) return;
        
        // Create whisper-like noise
        const bufferSize = this.audioContext.sampleRate * 2;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            const t = i / this.audioContext.sampleRate;
            data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 0.5) * 0.3;
        }
        
        const source = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, this.audioContext.currentTime);
        filter.Q.setValueAtTime(2, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.03, this.audioContext.currentTime);
        
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.musicGain);
        
        source.start();
    }
    
    playCreepyChimes() {
        if (!this.audioContext) return;
        
        const frequencies = [523.25, 587.33, 659.25, 698.46, 783.99]; // C5, D5, E5, F5, G5
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(
                    frequencies[Math.floor(Math.random() * frequencies.length)], 
                    this.audioContext.currentTime
                );
                
                const now = this.audioContext.currentTime;
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(0.04, now + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + 3);
                
                oscillator.connect(gainNode);
                gainNode.connect(this.musicGain);
                
                oscillator.start(now);
                oscillator.stop(now + 3);
            }, i * 800 + Math.random() * 400);
        }
    }
    
    createPsychologicalTensionTheme() {
        // Create the main psychological horror theme using minor scales and tritones
        const playThemeNote = (frequency, delay, duration, volume) => {
            setTimeout(() => {
                if (!this.audioContext) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                
                // Dark filtering
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(frequency * 1.2, this.audioContext.currentTime);
                filter.Q.setValueAtTime(3, this.audioContext.currentTime);
                
                const now = this.audioContext.currentTime;
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(volume, now + 0.3);
                gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.musicGain);
                
                oscillator.start(now);
                oscillator.stop(now + duration);
            }, delay);
        };
        
        // Horror theme melody using psychological intervals (tritones, minor seconds)
        const theme = () => {
            // Main motif - creating unease with dissonant intervals
            playThemeNote(220, 0, 4, 0.06);      // A3
            playThemeNote(233.08, 2000, 4, 0.06); // Bb3 (minor second - very unsettling)
            playThemeNote(311.13, 4000, 6, 0.08); // Eb4 (tritone - "devil's interval")
            playThemeNote(293.66, 8000, 8, 0.05); // D4 (resolve down for unsettling effect)
            
            // Echo the theme at different octaves for layering
            setTimeout(() => {
                playThemeNote(110, 0, 4, 0.04);      // A2 (octave lower)
                playThemeNote(116.54, 2000, 4, 0.04); // Bb2
                playThemeNote(155.56, 4000, 6, 0.05); // Eb3
                playThemeNote(146.83, 8000, 8, 0.03); // D3
            }, 1000);
            
            // Schedule next iteration with irregular timing
            setTimeout(theme, 25000 + Math.random() * 15000); // 25-40 seconds
        };
        
        // Start theme after 10 seconds
        setTimeout(theme, 10000);
    }
    
    createDeepUnsettlingDrones() {
        // Create multiple layers of deep, unsettling drones
        this.createDarkDrone(41.2, 0.05, 'sawtooth');  // E1 - very deep bass
        this.createDarkDrone(55, 0.04, 'square');      // A1 - root note
        this.createDarkDrone(73.42, 0.03, 'triangle'); // D2 - fourth above
        this.createDarkDrone(98, 0.025, 'sine');       // G2 - minor seventh (dissonant)
    }
    
    createDiscordantOrchestralElements() {
        // Create string-like sustained dissonant chords
        const createStringSection = (baseFreq, volume, detune) => {
            for (let i = 0; i < 4; i++) {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                const filter = this.audioContext.createBiquadFilter();
                
                oscillator.type = 'sawtooth'; // More string-like
                oscillator.frequency.setValueAtTime(baseFreq * (1 + i * 0.25), this.audioContext.currentTime); // Perfect fourth intervals
                oscillator.detune.setValueAtTime(detune + (i * 3), this.audioContext.currentTime); // Slight detuning
                
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(baseFreq * 2, this.audioContext.currentTime);
                filter.Q.setValueAtTime(1.5, this.audioContext.currentTime);
                
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(volume / 4, this.audioContext.currentTime + 8);
                
                oscillator.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(this.musicGain);
                
                oscillator.start();
                
                // Add slow tremolo for horror effect
                const lfo = this.audioContext.createOscillator();
                const lfoGain = this.audioContext.createGain();
                
                lfo.type = 'sine';
                lfo.frequency.setValueAtTime(0.3 + Math.random() * 0.4, this.audioContext.currentTime);
                lfoGain.gain.setValueAtTime(volume / 8, this.audioContext.currentTime);
                
                lfo.connect(lfoGain);
                lfoGain.connect(gainNode.gain);
                lfo.start();
            }
        };
        
        // Create dissonant string sections
        createStringSection(220, 0.03, -5);  // A3 minor chord
        createStringSection(293.66, 0.025, 5); // D4 chord (tritone relation)
    }
    
    createReversePianoNotes() {
        // Create reverse piano attack sounds for psychological horror
        const playReversePiano = () => {
            if (!this.audioContext) return;
            
            const frequencies = [523.25, 622.25, 698.46, 783.99, 880]; // C5, Eb5, F5, G5, A5
            const selectedFreq = frequencies[Math.floor(Math.random() * frequencies.length)];
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(selectedFreq, this.audioContext.currentTime);
            
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(selectedFreq * 2, this.audioContext.currentTime);
            
            const now = this.audioContext.currentTime;
            // Reverse envelope - starts quiet and builds up, then cuts off abruptly
            gainNode.gain.setValueAtTime(0.001, now);
            gainNode.gain.exponentialRampToValueAtTime(0.04, now + 2);
            gainNode.gain.linearRampToValueAtTime(0, now + 2.1);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.musicGain);
            
            oscillator.start(now);
            oscillator.stop(now + 2.1);
            
            // Schedule next reverse piano note
            setTimeout(playReversePiano, 15000 + Math.random() * 25000); // 15-40 seconds
        };
        
        // Start after 20 seconds
        setTimeout(playReversePiano, 20000);
    }
    
    createBuildingTensionSweeps() {
        // Create rising tension sweeps that build psychological pressure
        const createTensionSweep = () => {
            if (!this.audioContext) return;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            const filter = this.audioContext.createBiquadFilter();
            
            oscillator.type = 'sawtooth';
            
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(200, this.audioContext.currentTime);
            
            const now = this.audioContext.currentTime;
            const sweepDuration = 8 + Math.random() * 6; // 8-14 seconds
            
            // Slow rising frequency sweep
            oscillator.frequency.setValueAtTime(40, now);
            oscillator.frequency.exponentialRampToValueAtTime(400, now + sweepDuration);
            
            // Slow building volume
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.02, now + sweepDuration * 0.8);
            gainNode.gain.linearRampToValueAtTime(0, now + sweepDuration);
            
            // Filter sweep for extra tension
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.exponentialRampToValueAtTime(800, now + sweepDuration);
            
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(this.musicGain);
            
            oscillator.start(now);
            oscillator.stop(now + sweepDuration);
            
            // Schedule next sweep with long intervals
            setTimeout(createTensionSweep, 30000 + Math.random() * 45000); // 30-75 seconds
        };
        
        // Start first sweep after 30 seconds
        setTimeout(createTensionSweep, 30000);
    }
    
    playSound(soundName, volume = 1.0, pitch = 1.0) {
        if (!this.audioContext || !this.sounds[soundName]) return;
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = this.sounds[soundName];
        source.playbackRate.setValueAtTime(pitch, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        source.connect(gainNode);
        gainNode.connect(this.sfxGain);
        
        const now = this.audioContext.currentTime;
        source.start(now);
    }
    
    resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    createFlowers() {
        // Add colorful flowers scattered across the yellow terrain
        const flowerColors = [
            0xFF1744, // Red
            0xE91E63, // Pink
            0x9C27B0, // Purple
            0x673AB7, // Deep Purple
            0x3F51B5, // Indigo
            0x2196F3, // Blue
            0x00BCD4, // Cyan
            0x4CAF50, // Green
            0xFF9800, // Orange
            0xFF5722, // Deep Orange
        ];
        
        for (let i = 0; i < 200; i++) { // Restored from 25 to 200
            const flower = new THREE.Group();
            
            // Flower center
            const centerGeometry = new THREE.SphereGeometry(0.08, 6, 6);
            const centerMaterial = new THREE.MeshLambertMaterial({ color: 0xFFEB3B });
            const center = new THREE.Mesh(centerGeometry, centerMaterial);
            center.position.y = 0.2;
            flower.add(center);
            
            // Flower petals
            const petalColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            for (let j = 0; j < 5; j++) {
                const petalGeometry = new THREE.SphereGeometry(0.15, 6, 6);
                const petalMaterial = new THREE.MeshLambertMaterial({ color: petalColor });
                const petal = new THREE.Mesh(petalGeometry, petalMaterial);
                
                const angle = (j / 5) * Math.PI * 2;
                petal.position.set(
                    Math.cos(angle) * 0.2,
                    0.15,
                    Math.sin(angle) * 0.2
                );
                petal.scale.set(0.8, 0.3, 0.8);
                flower.add(petal);
            }
            
            // Stem
            const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3);
            const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            stem.position.y = 0.05;
            flower.add(stem);
            
            // Position flower on terrain
            const x = (Math.random() - 0.5) * 90; // Restored to previous range
            const z = (Math.random() - 0.5) * 90;
            const height = this.getTerrainHeight(x, z);
            
            flower.position.set(x, height + 0.1, z); // Slightly above ground to avoid clipping
            flower.scale.setScalar(0.8 + Math.random() * 0.4);
            flower.rotation.y = Math.random() * Math.PI * 2;
            
            this.scene.add(flower);
        }
    }
    
    createGrassPatches() {
        // Add varied grass patches
        for (let i = 0; i < 150; i++) { // Restored to previous count
            const grassPatch = new THREE.Group();
            
            // Create multiple grass blades per patch
            for (let j = 0; j < 3 + Math.floor(Math.random() * 4); j++) {
                const grassGeometry = new THREE.ConeGeometry(0.05, 0.5 + Math.random() * 0.5, 3);
                const grassMaterial = new THREE.MeshLambertMaterial({ 
                    color: new THREE.Color().setHSL(0.25 + Math.random() * 0.15, 0.7, 0.3 + Math.random() * 0.4)
                });
                
                const grass = new THREE.Mesh(grassGeometry, grassMaterial);
                grass.position.set(
                    (Math.random() - 0.5) * 0.5,
                    (0.5 + Math.random() * 0.5) / 2,
                    (Math.random() - 0.5) * 0.5
                );
                grass.rotation.z = (Math.random() - 0.5) * 0.3;
                grassPatch.add(grass);
            }
            
            const x = (Math.random() - 0.5) * 90; // Restored to previous range
            const z = (Math.random() - 0.5) * 90;
            const height = this.getTerrainHeight(x, z);
            
            grassPatch.position.set(x, height + 0.05, z); // Slightly above ground
            grassPatch.rotation.y = Math.random() * Math.PI * 2;
            
            this.scene.add(grassPatch);
        }
    }
    
    createBushes() {
        // Add small decorative bushes
        for (let i = 0; i < 80; i++) { // Restored to previous count
            const bush = new THREE.Group();
            
            // Main bush body - multiple spheres for organic look
            for (let j = 0; j < 3 + Math.floor(Math.random() * 3); j++) {
                const bushGeometry = new THREE.SphereGeometry(0.3 + Math.random() * 0.4, 8, 6);
                const bushMaterial = new THREE.MeshLambertMaterial({ 
                    color: new THREE.Color().setHSL(0.25 + Math.random() * 0.1, 0.6, 0.2 + Math.random() * 0.3)
                });
                
                const bushPart = new THREE.Mesh(bushGeometry, bushMaterial);
                bushPart.position.set(
                    (Math.random() - 0.5) * 0.6,
                    0.2 + Math.random() * 0.3,
                    (Math.random() - 0.5) * 0.6
                );
                bushPart.scale.setScalar(0.7 + Math.random() * 0.6);
                bush.add(bushPart);
            }
            
            // Add some small flowers on bushes
            if (Math.random() < 0.4) {
                const flowerGeometry = new THREE.SphereGeometry(0.08, 6, 6);
                const flowerMaterial = new THREE.MeshLambertMaterial({ 
                    color: [0xFF1744, 0xE91E63, 0x9C27B0, 0x2196F3][Math.floor(Math.random() * 4)]
                });
                const bushFlower = new THREE.Mesh(flowerGeometry, flowerMaterial);
                bushFlower.position.set(
                    (Math.random() - 0.5) * 0.8,
                    0.4 + Math.random() * 0.4,
                    (Math.random() - 0.5) * 0.8
                );
                bush.add(bushFlower);
            }
            
            const x = (Math.random() - 0.5) * 90; // Restored to previous range
            const z = (Math.random() - 0.5) * 90;
            const height = this.getTerrainHeight(x, z);
            
            bush.position.set(x, height + 0.2, z); // Proper ground positioning
            bush.scale.setScalar(0.8 + Math.random() * 0.4);
            
            this.scene.add(bush);
        }
    }
    
    createRocks() {
        // Add rocks for terrain detail
        for (let i = 0; i < 15; i++) { // Restored to previous count
            const rockGeometry = new THREE.DodecahedronGeometry(0.5 + Math.random() * 1);
            const rockMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(0.08, 0.2, 0.4 + Math.random() * 0.3)
            });
            
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            
            const x = (Math.random() - 0.5) * 90; // Restored to previous range
            const z = (Math.random() - 0.5) * 90;
            const height = this.getTerrainHeight(x, z);
            
            rock.position.set(x, height + 0.25, z); // Position rock properly on terrain
            rock.scale.setScalar(0.5 + Math.random() * 0.8);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.castShadow = true;
            
            this.scene.add(rock);
        }
    }
    
    getTerrainHeight(x, z) {
        // Approximate the terrain height calculation for object placement
        const nx = x / 100; // Restored to previous terrain size
        const nz = z / 100;
        
        // Create gentle rolling hills (matching createDiverseTerrain)
        let height = 0;
        height += Math.sin(nx * 3) * Math.cos(nz * 3) * 2;  // Large rolling hills
        height += Math.sin(nx * 6) * Math.cos(nz * 6) * 1;  // Medium hills
        height += Math.sin(nx * 12) * Math.cos(nz * 12) * 0.3; // Small variations
        
        // Create some flat plains areas
        const plainNoise = Math.sin(nx * 4) * Math.cos(nz * 4);
        if (Math.abs(plainNoise) < 0.3) {
            height *= 0.2; // Flatten for plains
        }
        
        return height;
    }
    
    checkBoundaries(position) {
        // Check if position is within world bounds and enforce air walls
        let bounded = false;
        
        if (position.x < this.worldBounds.minX) {
            position.x = this.worldBounds.minX;
            bounded = true;
        }
        if (position.x > this.worldBounds.maxX) {
            position.x = this.worldBounds.maxX;
            bounded = true;
        }
        if (position.z < this.worldBounds.minZ) {
            position.z = this.worldBounds.minZ;
            bounded = true;
        }
        if (position.z > this.worldBounds.maxZ) {
            position.z = this.worldBounds.maxZ;
            bounded = true;
        }
        
        return bounded;
    }
    
    createTrees() {
        // Add Ghibli-style trees
        for (let i = 0; i < 25; i++) { // Restored to previous count
            const tree = new THREE.Group();
            
            // Trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4);
            const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 2;
            trunk.castShadow = true;
            tree.add(trunk);
            
            // Leaves - fluffy Ghibli style
            const leavesGeometry = new THREE.SphereGeometry(3, 8, 6);
            const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = 5;
            leaves.castShadow = true;
            tree.add(leaves);
            
            // Position in world
            const x = (Math.random() - 0.5) * 90; // Restored to previous range
            const z = (Math.random() - 0.5) * 90;
            const height = this.getTerrainHeight(x, z);
            tree.position.set(x, height, z); // Trees positioned properly on terrain
            tree.scale.setScalar(0.8 + Math.random() * 0.4);
            
            this.scene.add(tree);
        }
    }
    
    startGame() {
        this.gameTime = 0;
        this.health = 100;
        this.score = 0;
        this.gameRunning = true;
        this.updateUI();
        
        // Start enemy spawning
        this.spawnEnemies();
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            document.exitPointerLock();
        } else {
            this.renderer.domElement.requestPointerLock();
        }
    }
    
    updatePlayer(deltaTime) {
        if (this.isPaused || !this.gameRunning) return;
        
        // Mouse look
        this.player.rotation.y = -this.mouse.x;
        this.player.rotation.x = -this.mouse.y;
        
        // Movement
        const moveVector = new THREE.Vector3();
        if (this.keys['KeyW']) moveVector.z -= 1;
        if (this.keys['KeyS']) moveVector.z += 1;
        if (this.keys['KeyA']) moveVector.x -= 1;
        if (this.keys['KeyD']) moveVector.x += 1;
        
        if (moveVector.length() > 0) {
            moveVector.normalize();
            moveVector.multiplyScalar(this.player.speed * deltaTime);
            
            // Apply rotation to movement
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(new THREE.Euler(0, this.player.rotation.y, 0));
            moveVector.applyQuaternion(quaternion);
            
            this.player.position.add(moveVector);
            
            // Enforce air wall boundaries for player
            this.checkBoundaries(this.player.position);
            
            // Keep player on terrain surface
            const terrainHeight = this.getTerrainHeight(this.player.position.x, this.player.position.z);
            this.player.position.y = terrainHeight + 1.7;
            
            // Create footstep dust when moving
            this.createFootstepDust(this.player.position);
        }
        
        // Update camera - Fix FPS camera rotation order
        this.camera.position.copy(this.player.position);
        this.camera.rotation.order = 'YXZ'; // Set rotation order for proper FPS controls
        this.camera.rotation.set(this.player.rotation.x, this.player.rotation.y, 0);
        
        // Update player's light to follow player and aim where they're looking
        if (this.playerLight) {
            this.playerLight.position.copy(this.player.position);
            this.playerLight.position.y += 0.5; // Slightly above player
            
            // Make light point in the direction the player is looking
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            this.playerLight.target.position.copy(this.player.position).add(direction.multiplyScalar(10));
        }
    }
    
    spawnEnemies() {
        const spawnEnemy = () => {
            if (!this.gameRunning || this.isPaused) {
                // Reschedule even if paused to maintain spawning
                setTimeout(spawnEnemy, this.getCurrentSpawnInterval());
                return;
            }
            
            const enemy = this.createEnemy();
            this.enemies.push(enemy);
            
            // Schedule next enemy spawn with current difficulty
            setTimeout(spawnEnemy, this.getCurrentSpawnInterval());
        };
        
        // Start spawning
        setTimeout(spawnEnemy, this.getCurrentSpawnInterval());
    }
    
    getCurrentSpawnInterval() {
        // Calculate difficulty multiplier based on minutes elapsed
        const minutesElapsed = Math.floor(this.gameTime / 60);
        const spawnRateMultiplier = Math.pow(1.2, minutesElapsed); // 20% increase per minute
        
        // Decrease interval (increase spawn rate) - minimum interval of 200ms
        return Math.max(200, this.baseSpawnInterval / spawnRateMultiplier);
    }
    
    getCurrentEnemySpeed() {
        // Calculate speed multiplier based on minutes elapsed
        const minutesElapsed = Math.floor(this.gameTime / 60);
        const speedMultiplier = Math.pow(1.2, minutesElapsed); // 20% increase per minute
        
        return this.baseEnemySpeed * speedMultiplier;
    }
    
    createEnemy() {
        // Create pill-shaped enemy with green lower body and white upper body
        const enemyGroup = new THREE.Group();
        
        // Lower body (green pill shape)
        const lowerBodyGeometry = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
        const lowerBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x00AA00 }); // Green
        const lowerBody = new THREE.Mesh(lowerBodyGeometry, lowerBodyMaterial);
        lowerBody.position.y = -0.5;
        enemyGroup.add(lowerBody);
        
        // Upper body (white pill shape)
        const upperBodyGeometry = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
        const upperBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // White
        const upperBody = new THREE.Mesh(upperBodyGeometry, upperBodyMaterial);
        upperBody.position.y = 0.5;
        enemyGroup.add(upperBody);
        
        // Spawn at random position around player (restored range)
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 20; // Restored to previous range
        const spawnX = this.player.position.x + Math.cos(angle) * distance;
        const spawnZ = this.player.position.z + Math.sin(angle) * distance;
        const terrainHeight = this.getTerrainHeight(spawnX, spawnZ);
        
        enemyGroup.position.set(spawnX, terrainHeight + 1, spawnZ); // Position on terrain surface
        
        enemyGroup.health = 100;
        enemyGroup.speed = this.getCurrentEnemySpeed(); // Use dynamic speed based on difficulty
        enemyGroup.castShadow = true;
        
        this.scene.add(enemyGroup);
        return enemyGroup;
    }
    
    createGiantEnemy() {
        // Create giant pill-shaped enemy with green lower body and white upper body
        const giantEnemyGroup = new THREE.Group();
        
        // Giant lower body (green pill shape)
        const lowerBodyGeometry = new THREE.CapsuleGeometry(1.0, 2.0, 4, 8); // Double size
        const lowerBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x007700 }); // Darker green
        const lowerBody = new THREE.Mesh(lowerBodyGeometry, lowerBodyMaterial);
        lowerBody.position.y = -1.0;
        giantEnemyGroup.add(lowerBody);
        
        // Giant upper body (white pill shape)
        const upperBodyGeometry = new THREE.CapsuleGeometry(1.0, 2.0, 4, 8); // Double size
        const upperBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xF0F0F0 }); // Slightly off-white
        const upperBody = new THREE.Mesh(upperBodyGeometry, upperBodyMaterial);
        upperBody.position.y = 1.0;
        giantEnemyGroup.add(upperBody);
        
        // Spawn at random position around player
        const angle = Math.random() * Math.PI * 2;
        const distance = 35 + Math.random() * 15; // Slightly further away
        const spawnX = this.player.position.x + Math.cos(angle) * distance;
        const spawnZ = this.player.position.z + Math.sin(angle) * distance;
        const terrainHeight = this.getTerrainHeight(spawnX, spawnZ);
        
        giantEnemyGroup.position.set(spawnX, terrainHeight + 2, spawnZ); // Position higher due to size
        
        // Giant enemy properties
        giantEnemyGroup.health = 1000; // 10 attacks to kill (10 × 100 damage)
        giantEnemyGroup.maxHealth = 1000;
        giantEnemyGroup.speed = this.getCurrentEnemySpeed() * 0.7; // Slower than regular enemies
        giantEnemyGroup.isGiant = true; // Mark as giant enemy
        giantEnemyGroup.castShadow = true;
        
        // Add a glowing effect to make it more menacing
        const glowGeometry = new THREE.SphereGeometry(4, 16, 16); // Bigger glow for giant
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.1
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 0;
        giantEnemyGroup.add(glow);
        
        // Add pulsing glow animation
        giantEnemyGroup.glowTime = 0;
        
        // Add health bar above giant enemy
        this.createGiantHealthBar(giantEnemyGroup);
        
        this.scene.add(giantEnemyGroup);
        return giantEnemyGroup;
    }
    
    createGiantHealthBar(enemy) {
        // Create health bar background
        const barGeometry = new THREE.PlaneGeometry(4, 0.3);
        const barBackgroundMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.8
        });
        const healthBarBackground = new THREE.Mesh(barGeometry, barBackgroundMaterial);
        healthBarBackground.position.set(0, 3.5, 0); // Adjusted for pill shape height
        healthBarBackground.lookAt(0, 3.5, 1); // Face camera initially
        enemy.add(healthBarBackground);
        
        // Create health bar foreground
        const healthBarMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFF0000,
            transparent: true,
            opacity: 0.9
        });
        const healthBar = new THREE.Mesh(barGeometry, healthBarMaterial);
        healthBar.position.set(0, 3.51, 0); // Adjusted for pill shape height
        healthBar.lookAt(0, 3.51, 1); // Face camera initially
        enemy.add(healthBar);
        
        // Store reference for updates
        enemy.healthBar = healthBar;
        enemy.healthBarBackground = healthBarBackground;
    }
    
    updateGiantHealthBar(enemy) {
        if (enemy.healthBar && enemy.healthBarBackground) {
            // Update health bar scale based on current health
            const healthPercent = enemy.health / enemy.maxHealth;
            enemy.healthBar.scale.x = Math.max(0, healthPercent);
            
            // Change color based on health
            if (healthPercent > 0.6) {
                enemy.healthBar.material.color.setHex(0xFF0000); // Red
            } else if (healthPercent > 0.3) {
                enemy.healthBar.material.color.setHex(0xFF6600); // Orange
            } else {
                enemy.healthBar.material.color.setHex(0xFF0000); // Bright red
            }
            
            // Make health bar face the camera
            const cameraPosition = this.camera.position;
            enemy.healthBar.lookAt(cameraPosition);
            enemy.healthBarBackground.lookAt(cameraPosition);
        }
    }
    
    shoot() {
        if (this.isPaused || !this.gameRunning) return;
        
        // Play gunshot sound
        this.playSound('gunshot', 0.7, 0.9 + Math.random() * 0.2);
        
        const bulletGeometry = new THREE.SphereGeometry(0.15);
        const bulletMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFFFF00,
            transparent: true,
            opacity: 0.9
        });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Add a glowing trail effect
        const trailGeometry = new THREE.SphereGeometry(0.08);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFAA00,
            transparent: true,
            opacity: 0.6
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        bullet.add(trail);
        
        bullet.position.copy(this.camera.position);
        
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        bullet.velocity = direction.multiplyScalar(50);
        bullet.life = 2;
        
        // Create muzzle flash effect
        const muzzlePosition = this.camera.position.clone();
        muzzlePosition.add(direction.clone().multiplyScalar(1));
        this.createMuzzleFlash(muzzlePosition);
        
        this.bullets.push(bullet);
        this.scene.add(bullet);
    }
    
    updateEnemies(deltaTime) {
        this.enemies.forEach((enemy, index) => {
            // Update pulsing glow for giant enemies
            if (enemy.isGiant && enemy.children.length > 0) {
                enemy.glowTime += deltaTime * 2;
                const glow = enemy.children[0];
                glow.material.opacity = 0.05 + 0.05 * Math.sin(enemy.glowTime);
                
                // Update health bar for giant enemies
                this.updateGiantHealthBar(enemy);
            }
            
            // Move towards player
            const direction = new THREE.Vector3();
            direction.subVectors(this.player.position, enemy.position);
            direction.y = 0;
            direction.normalize();
            direction.multiplyScalar(enemy.speed * deltaTime);
            
            enemy.position.add(direction);
            
            // Enforce air wall boundaries for enemies
            this.checkBoundaries(enemy.position);
            
            // Keep enemies on terrain surface
            const terrainHeight = this.getTerrainHeight(enemy.position.x, enemy.position.z);
            enemy.position.y = terrainHeight + (enemy.isGiant ? 2 : 1);
            
            // Check collision with player
            const distance = enemy.position.distanceTo(this.player.position);
            const collisionDistance = enemy.isGiant ? 3 : 2; // Giant enemies have larger collision
            
            if (distance < collisionDistance) {
                const damage = enemy.isGiant ? 20 : 10; // Giant enemies deal more damage
                this.takeDamage(damage);
                this.removeEnemy(index);
            }
        });
    }
    
    updateBullets(deltaTime) {
        this.bullets.forEach((bullet, bulletIndex) => {
            bullet.position.add(bullet.velocity.clone().multiplyScalar(deltaTime));
            bullet.life -= deltaTime;
            
            // Check collision with enemies
            this.enemies.forEach((enemy, enemyIndex) => {
                const distance = bullet.position.distanceTo(enemy.position);
                const hitDistance = enemy.isGiant ? 1.5 : 1; // Giant enemies are easier to hit
                
                if (distance < hitDistance) {
                    // Create hit effect and damage enemy
                    this.createHitEffect(enemy.position);
                    
                    // Play hit sound
                    this.playSound('hit', 0.5, 0.8 + Math.random() * 0.4);
                    
                    // Damage enemy
                    enemy.health -= 100; // Standard damage per hit
                    
                    if (enemy.health <= 0) {
                        // Enemy is dead - create death effects
                        this.createDeathExplosion(enemy.position);
                        this.playSound('explosion', 0.6, 0.9 + Math.random() * 0.2);
                        this.playSound('enemyDeath', 0.4, 0.8 + Math.random() * 0.4);
                        
                        // Award points based on enemy type
                        const points = enemy.isGiant ? 50 : 10;
                        this.score += points;
                        
                        this.removeEnemy(enemyIndex);
                    } else if (enemy.isGiant) {
                        // Giant enemy took damage but didn't die - flash red
                        const originalColor = enemy.material.color.clone();
                        enemy.material.color.setHex(0xFFAAAA);
                        setTimeout(() => {
                            if (enemy.material) {
                                enemy.material.color.copy(originalColor);
                            }
                        }, 100);
                    }
                    
                    this.removeBullet(bulletIndex);
                }
            });
            
            // Remove old bullets
            if (bullet.life <= 0) {
                this.removeBullet(bulletIndex);
            }
        });
    }
    
    removeEnemy(index) {
        if (this.enemies[index]) {
            this.scene.remove(this.enemies[index]);
            this.enemies.splice(index, 1);
        }
    }
    
    removeBullet(index) {
        if (this.bullets[index]) {
            this.scene.remove(this.bullets[index]);
            this.bullets.splice(index, 1);
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.gameRunning = false;
        document.exitPointerLock();
        
        // Calculate final difficulty multiplier
        const minutesElapsed = Math.floor(this.gameTime / 60);
        const finalDifficulty = Math.pow(1.2, minutesElapsed);
        
        // Update game over UI with final stats
        document.getElementById('finalTime').textContent = this.formatTime(this.gameTime);
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalDifficulty').textContent = finalDifficulty.toFixed(1) + 'x';
        
        // Show game over UI
        document.getElementById('gameOverUI').style.display = 'flex';
    }
    
    updateUI() {
        document.getElementById('timer').textContent = this.formatTime(this.gameTime);
        document.getElementById('health').textContent = Math.max(0, this.health);
        document.getElementById('score').textContent = this.score;
        
        // Update difficulty multiplier display (based on spawn rate increase)
        const minutesElapsed = Math.floor(this.gameTime / 60);
        const difficultyMultiplier = Math.pow(1.2, minutesElapsed); // Based on 20% spawn increase
        document.getElementById('difficulty').textContent = difficultyMultiplier.toFixed(1) + 'x';
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        if (this.gameRunning && !this.isPaused) {
            this.gameTime += deltaTime;
            
            // Check for giant enemy spawning every minute
            const currentMinute = Math.floor(this.gameTime / 60);
            const lastMinute = Math.floor((this.gameTime - deltaTime) / 60);
            
            if (currentMinute > lastMinute && currentMinute > 0) {
                // Spawn a giant enemy at each minute mark
                const giantEnemy = this.createGiantEnemy();
                this.enemies.push(giantEnemy);
                console.log(`Giant enemy spawned at minute ${currentMinute}!`);
            }
            
            this.updatePlayer(deltaTime);
            this.updateEnemies(deltaTime);
            this.updateBullets(deltaTime);
            this.updateUI();
        }
        
        // Always update particles and atmospheric effects
        this.updateParticles(deltaTime);
        
        // Animate stars slowly with twinkling effect
        if (this.starGroup) {
            this.starGroup.rotation.y += deltaTime * 0.005;
            this.starGroup.children.forEach((star, index) => {
                // Twinkling effect
                const time = this.clock.getElapsedTime();
                star.material.opacity = 0.6 + 0.4 * Math.sin(time * 2 + index);
            });
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new GhibliSurvivors();
});