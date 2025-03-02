import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

    class MassSpringDamperPhysics {
        constructor(mass, stifness, dampness, displacement) {
            this.mass = mass;
            this.stifness = stifness;
            this.dampness = dampness;
            this.position = displacement;
            this.velocity = 0;
        }

        advance(elapsedTime) {
            const maxTimeStep = 0.01;
            let timeStep;

            while (elapsedTime > 0) {
                var force = -this.stifness * this.position - this.dampness * this.velocity;
                var acceleration = force / this.mass;

                if (elapsedTime > maxTimeStep) {
                    timeStep = maxTimeStep;
                    elapsedTime -= maxTimeStep;
                } else {
                    timeStep = elapsedTime;
                    elapsedTime = 0;
                }

                this.velocity += acceleration * timeStep;
                this.position += this.velocity * timeStep;
            }
        }
    }

class SpringMesh extends THREE.Mesh {
    constructor(length, radius, turns, thickness, radialSegments, segmentsPerTurn, material) {
        let geometry = new THREE.CylinderGeometry(thickness, thickness, 1, radialSegments, segmentsPerTurn * turns);
        geometry.translate(0, 0.5, 0).rotateX(Math.PI * 0.5); // Move the cylinder start to the origin and rotate it to align with the Y axis
        super(geometry, material);
        this.cylinderVertices = geometry.attributes.position.clone();
        this.geometry = geometry;
        this.radius = radius;
        this.turns = turns;
        this.length = length;
        this.updateGeometry();
    }

    updateGeometry() {
        let yAxis = new THREE.Vector3(0, 1, 0);
        let vertex = new THREE.Vector3();
        let helixCoord = new THREE.Vector3();

        let springVertices = this.geometry.attributes.position;
        for (let i = 0; i < this.cylinderVertices.count; i++) {
            let ratio = this.cylinderVertices.getZ(i); // 0 to 1.0
            let angle = this.turns * Math.PI * 2 * ratio;
            vertex.fromBufferAttribute(this.cylinderVertices, i).setZ(0); // Collapse all circles of the cylinder to a XY plane

            if (angle < Math.PI * 2) { //first turn and half
                helixCoord.setFromCylindricalCoords(this.radius * angle / (Math.PI * 2), angle, this.length * ratio);
            } else if (angle > (this.turns - 1) * Math.PI * 2) {
                helixCoord.setFromCylindricalCoords(this.radius * (this.turns * Math.PI * 2 - angle) / (Math.PI * 2), angle, this.length * ratio);
            } else {
                helixCoord.setFromCylindricalCoords(this.radius, angle, this.length * ratio);
            }

            vertex.applyAxisAngle(yAxis, angle + Math.PI * 0.5); // Rotate each circle to align with the helix        
            vertex.add(helixCoord); // Translate each circle to its position in the helix
            springVertices.setXYZ(i, ...vertex);
        }
        this.geometry.computeVertexNormals();
        springVertices.needsUpdate = true;

    }
}


function createMassSpring3DModel() {
    // The model consists of three parts: a hanger to which the spring attaches, a spring, and a ball attached to the spring.

    let ballRadius = 1.0;
    let springLength = 6;

    let springRadius = ballRadius * 0.5;
    let springTurns = 12;
    let springThickness = 0.1;
    let springSegmentsPerTurn = 100;
    let springRadialSegments = 32;

    let ballWidthSegments = 128;
    let ballHeightSegments = 64;

    let materialMetalness = 1.0;
    let materialRoughness = 0.0;

    const springMaterial = new THREE.MeshStandardMaterial({ metalness: materialMetalness, color: 0xffffff, roughness: materialRoughness });
    let spring = new SpringMesh(springLength, springRadius, springTurns, springThickness, springRadialSegments, springSegmentsPerTurn, springMaterial);

    const hangerMaterial = new THREE.MeshStandardMaterial({ metalness: materialMetalness, color: 0x964B00, roughness: materialRoughness });
    const hangerGeometry = new THREE.BoxGeometry(springRadius * 3, springThickness * 2, springRadius * 3);
    const hanger = new THREE.Mesh(hangerGeometry, hangerMaterial);

    const ballMaterial = new THREE.MeshStandardMaterial({ metalness: materialMetalness, color: 0xffffbb, roughness: materialRoughness });

    const ballGeometry = new THREE.SphereGeometry(ballRadius, ballWidthSegments, ballHeightSegments);
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    let ballShift = springLength + ballRadius * 0.9; // Shift the ball to the end of the spring
    ball.position.y = ballShift;

    // Combine the three objects into a single model
    let model = new THREE.Group();
    model.add(spring);
    model.add(hanger);
    model.add(ball);

    // Add a function to change the length of the spring and the position of the ball
    model.setStretch = (stretch) => {
        ball.position.y = ballShift + stretch;
        spring.length = springLength + stretch;
        spring.updateGeometry();
    }

    return model;
}


//  Create the renderer and add it to the DOM
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Create the scene and add a background and environment map which will be used for lighting
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x444444);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;


//Create the 3D model and add it to the scene
const model = createMassSpring3DModel();
scene.add(model);
model.rotateZ(Math.PI); // The model originally points upward along the y-axis. Rotate it to point downward.

// Add a grid to the scene, so we can get a better sense of the model's position
const gridHelper = new THREE.GridHelper(12, 12, 0xffffff, 0xffffff);
scene.add(gridHelper);
gridHelper.position.y = -12;

// Prepare the camera and its controls
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 100);
const cameraControls = new OrbitControls(camera, renderer.domElement);
camera.position.set(12, -6, 8);
cameraControls.target.set(0, -8.5, 0);

// Create a clock to keep track of simulation time
const clock = new THREE.Clock();
// Pause and resume the clock based on visibility of the web page
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        clock.stop();
    } else {
        clock.start();
    }
});

// Create the physics simulator with some initial parameters
const params = { mass: 0.5, stifness: 5.0, dampness: 0.0, displacement: 2.0 };
let simulation = new MassSpringDamperPhysics(params.mass, params.stifness, params.dampness, params.displacement);

// The animate function will be called every frame
function animate() {
    // Advance the simulation based on the time elapsed since the last frame
    simulation.advance(clock.getDelta());
    // Update the model's stretch based on the particle's position
    model.setStretch(simulation.position);
    // Update the camera controls and render the scene
    cameraControls.update();
    renderer.render(scene, camera);
}
// Setup the animation loop
renderer.setAnimationLoop(animate);

// Create a GUI to control the simulation parameters
const gui = new GUI({title: 'مدخلات المحاكاة'});
gui.add(params, 'mass', 0.05, 1, 0.05).name('الكتلة');
gui.add(params, 'stifness', 0.5, 10, 0.5).name('الصلابة');
gui.add(params, 'dampness', 0, 0.5, 0.01).name('التخميد');
gui.add(params, 'displacement', 0, 4, 0.5).name('الانزياح');

function resetSimulation() {
    simulation = new MassSpringDamperPhysics(params.mass, params.stifness, params.dampness, params.displacement);
    clock.getDelta(); // Reset the clock to current time
}
const actions = { resetSimulation };
gui.add(actions, 'resetSimulation').name('إعادة ضبط المحاكاة');
gui.close();

window.addEventListener( 'resize', onWindowResize, false );
function onWindowResize(){

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}