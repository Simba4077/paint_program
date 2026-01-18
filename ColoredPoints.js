// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }
`;

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// global variables: user interface elements or data passed from JavaScript to GLSL shaders
let canvas;
let gl;
let a_Position
let u_FragColor;
let u_Size;

function setupWebGL() {
  canvas = document.getElementById('webgl'); //do not use var, that makes a new local variable instead of using the current global one 

  // Get the rendering context for WebGL
  //gl = getWebGLContext(canvas);
  gl = canvas.getContext("webgl",{ preserveDrawingBuffer: true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if(!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return;
  }
}

//Constants
const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

// Global variables related to UI elements
let g_selectedColor=[1.0, 1.0, 1.0, 1.0];
let g_selectedSize = 5;
let g_selectedType = POINT;
let g_selectedSegments = 2;
let g_alpha = 1.0;

function addActionsForHtmlUI(){

  //button events
  document.getElementById('green').onclick = function () { g_selectedColor = [0.0, 1.0, 0.0, g_alpha]; };
  document.getElementById('red').onclick = function () { g_selectedColor = [1.0, 0.0, 0.0, g_alpha]; };
  document.getElementById('clearButton').onclick = function () { g_shapesList = []; renderAllShapes(); };

  document.getElementById('pointButton').onclick = function() {g_selectedType=POINT};
  document.getElementById('triButton').onclick = function() {g_selectedType=TRIANGLE};
  document.getElementById('circleButton').onclick = function() {g_selectedType=CIRCLE};
  document.getElementById('draw').onclick = function() {drawPicture();};

  //color slider events
  document.getElementById('redSlide').addEventListener('mouseup',function() { g_selectedColor[0] = this.value/100; g_selectedColor[3] = g_alpha;});
  document.getElementById('greenSlide').addEventListener('mouseup',function() { g_selectedColor[1] = this.value/100; g_selectedColor[3] = g_alpha; });
  document.getElementById('blueSlide').addEventListener('mouseup',function() { g_selectedColor[2] = this.value/100; g_selectedColor[3] = g_alpha;});

  //size slider events
  document.getElementById('sizeSlide').addEventListener('mouseup',function() {g_selectedSize=this.value;});

  //segment slider events
  document.getElementById('segmentSlide').addEventListener('mouseup',function() {g_selectedSegments=this.value;});

  //alpha slider events
  document.getElementById('alphaSlide').addEventListener('mouseup',function() {g_alpha = this.value/100;});

  //replay button event
  document.getElementById('replayButton').onclick = function() {replayDrawing()};

  //undo button event
  document.getElementById('undoButton').onclick = function() {undoLastShape()};
}

function main() {
  // Retrieve <canvas> element
  setupWebGL();
  
  // Initialize shaders
  connectVariablesToGLSL();

  //set up actions for HTML UI elements
  addActionsForHtmlUI();
 
  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) { if (ev.buttons == 1){ click(ev) } };

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  //add blending
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);
}



var g_shapesList = [];

// var g_points = [];  // The array for the position of a mouse press
// var g_colors = [];  // The array to store the color of a point
// var g_sizes = [];   // The array to store the size of a point

function click(ev) {
  //extract event click and convert coordinates to webGL coordinates
  let [x,y] = convertCoordinatesEventToGL(ev);

  //create and store the new point
  let point;
  if(g_selectedType == POINT){
    point = new Point();
  } else if (g_selectedType == CIRCLE){
    point = new Circle();
  } else{
    point = new Triangle();
  }
  point.position=[x, y];
  point.color=g_selectedColor.slice();
  point.color[3] = g_alpha;
  point.size=g_selectedSize;
  point.segments=g_selectedSegments;
  g_shapesList.push(point);
  
  // g_points.push([x, y]); // Store the coordinates to g_points array
  // g_colors.push(g_selectedColor.slice()); // Store the color to g_colors array
  // g_sizes.push(g_selectedSize); // Store the size to g_sizes array)
 
  // Store the coordinates to g_points array
  // if (x >= 0.0 && y >= 0.0) {      // First quadrant
  //   g_colors.push([1.0, 0.0, 0.0, 1.0]);  // Red
  // } else if (x < 0.0 && y < 0.0) { // Third quadrant
  //   g_colors.push([0.0, 1.0, 0.0, 1.0]);  // Green
  // } else {                         // Others
  //   g_colors.push([1.0, 1.0, 1.0, 1.0]);  // White
  // }
  //Draw shapes in the canvas
  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);
  return([x, y]);
}

function undoLastShape(){
  if (g_shapesList.length==0){
    return;
  }
  g_shapesList.pop();
  renderAllShapes();
}

function replayDrawing(){
  //clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT);
  let i = 0;
  var delay = 20;
  var timer = setInterval(() => {
    if(i>=g_shapesList.length){
      clearInterval(timer);
      return;
    }
    g_shapesList[i].render();
    i++;
  }, delay);
}

function renderAllShapes(){

  //check the time at the start of function 
  var startTime = performance.now();
  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  var len = g_shapesList.length;
  for(var i = 0; i < len; i++) {
    g_shapesList[i].render();

  var duration = performance.now() - startTime;
  sendTextToHTML("numdot: " +len+" ms: "+Math.floor(duration) + " fps: " + Math.floor(10000/duration), "numdot")
  } 
}

function sendTextToHTML(text, htmlID){
  var htmlElm = document.getElementById(htmlID);
  if(!htmlElm){
    console.log("Failed to get" + htmlID + "from HTML");
    return;
  }
  htmlElm.innerHTML = text;
}

function drawPicture(){
  g_shapesList = [];
  g_shapesList.push(

    // S shape
    new pictureTriangle(
      [.4,.2,  .4,.3,  0.1,0.3],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [0.1,0.2,  0.1,0.3,  0.4,0.2],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.2,0.2,  0.1,0.2,  0.1,0.0],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.2,0.2,  0.1,0.0,  0.2,0.0],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.2,0.0,  0.4,0.1,  0.2,0.1],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.2,0.0,  0.4,0.0,  0.4,0.1],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.3,0.0,  0.4,0.0,  0.4,0.1],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.3,0.0,  0.4,-0.2,  0.4,0.0],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.3,0.0,  0.3,-0.2,  0.4,-0.2],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.1,-0.1,  0.3,-0.1,  0.3,-0.2],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.1,-0.1,  0.1,-0.2,  0.3,-0.2],
      [1,0,1,1]
    ),

    //back fin 
    new pictureTriangle(
      [0.45,0.3,  0.5,0.0,  0.7,0.15],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.45,-0.3,  0.5,0.0,  0.7,-0.15],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.75,0.1,  0.5,0.0,  0.7,0.15],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.75,-0.1,  0.5,0.0,  0.7,-0.15],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [0.75,0.1,  0.5,0.0,  0.75,-0.1],
      [1,0,0,1]
    ),
    new pictureTriangle(
      [0.75,0.1,  0.9,0.1,  0.9,-0.1],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [0.75,0.1,  0.75,-0.1,  0.9,-0.1],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [0.75,0.1,  0.95,0.3,  0.9,0.1],
      [1,0,0,1]
    ),
    new pictureTriangle(
      [0.75,-0.1,  0.95,-0.3,  0.9,-0.1],
      [1,0,0,1]
    ),

    // M shape
    new pictureTriangle(
      [0.0,0.0,  0.0,0.3,  -0.2,0.0],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.4,0.3,  -0.4,0.0,  -0.2,0.0],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.1,0.0,  0.0,0.0,  0.0,-0.2],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.1,0.0,  -0.1,-0.2,  0.0,-0.2],
      [1,0,1,1]
    ),

    new pictureTriangle(
      [-0.2,-0.05,  -0.1,0.0,  -0.3,0.0],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [-0.4,0.0,  -0.3,0.0,  -0.3,-0.2],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.4,0.0,  -0.4,-0.2,  -0.3,-0.2],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [-0.1,0.3,  -0.2,0.1,  -0.3,0.29],
      [1,0,1,1]
    ),


    //fish head
    new pictureTriangle(
      [-0.65,0.0,  -0.5,0.0,  -0.45,0.3],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.65,0.0,  -0.5,0.0,  -0.45,-0.25],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.65,0.0,  -0.8,0.05,  -0.45,0.3],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.65,0.0,  -0.8,0.05,  -0.75,-0.05],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.97,-0.1,  -0.8,0.05,  -0.75,-0.05],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [-0.65,0.0,  -0.65,-0.1,  -0.45,-0.25],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [-0.85,-0.2,  -0.65,-0.1,  -0.45,-0.25],
      [1,0,0,1]
    ),
    new pictureTriangle(
      [-0.68,0.08,  -0.55,0.115,  -0.6,0.15],
      [0,0,0,1]
    ),
    //upper fin
    new pictureTriangle(
      [0.0,0.35,  -0.25,0.375,  0.0,0.4],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.05,0.5,  -0.25,0.375,  0.0,0.4],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.05,0.5,  0.05,0.6,  0.0,0.4],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [0.4,0.4,  0.05,0.6,  0.0,0.5],
      [1,0,0,1]
    ),
    //Bottom find
    new pictureTriangle(
      [0.0,-0.25,  -0.25,-0.275,  0.0,-0.3],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.05,-0.4,  -0.25,-0.275,  0.0,-0.3],
      [0,1,1,1]
    ),
    new pictureTriangle(
      [-0.05,-0.4,  0.05,-0.5,  0.0,-0.3],
      [1,0,1,1]
    ),
    new pictureTriangle(
      [0.4,-0.3,  0.05,-0.5,  0.0,-0.35],
      [1,0,0,1]
    ),
    )
  renderAllShapes();
}