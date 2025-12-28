import type { Tree } from './model/model';

/**
 * GPU-accelerated crowdedness calculation using WebGL2 Transform Feedback
 * Falls back to CPU if WebGL2 is not available
 *
 * ⚠️ WARNING: GPU logic broken; do not use
 * Transform feedback is not capturing shader output correctly - always returns zeros
 * CPU fallback works correctly
 */
export class GPUCrowdednessCalculator {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement;
  private isInitialized = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  /**
   * Initialize WebGL2 context and compile shaders
   * Returns true if GPU is available and initialized successfully
   *
   * ⚠️ DISABLED - GPU logic broken; do not use
   */
  init(): boolean {
    // GPU logic broken; do not use
    return false;

    /* DISABLED - GPU transform feedback broken
    if (this.isInitialized) return true;

    // Try to get WebGL2 context
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      console.warn('WebGL2 not available - GPU acceleration disabled');
      return false;
    }

    this.gl = gl;

    // Vertex shader - processes each tree in parallel
    const vertexShaderSource = `#version 300 es
      precision highp float;

      // Input: data for the tree being evaluated
      in vec2 position;
      in float size;
      in float spreadDistance;
      in float maxSize;

      // Uniform: all trees data in textures
      uniform sampler2D allTreesTexture;
      uniform sampler2D spreadTexture;
      uniform int numTrees;
      uniform int textureWidth;

      // Output: crowdedness value
      out float crowdedness;

      void main() {
        int treeId = gl_VertexID;
        float crowdednessSum = 0.0;

        // Debug: Set to 0.5 to verify shader is running
        crowdedness = 0.5;

        // Iterate through all trees
        for (int i = 0; i < numTrees; i++) {
          if (i == treeId) continue;  // Skip self

          // Fetch other tree data from textures
          int texY = i / textureWidth;
          int texX = i - (texY * textureWidth);
          vec4 otherTreeData = texelFetch(allTreesTexture, ivec2(texX, texY), 0);
          float otherSpreadDist = texelFetch(spreadTexture, ivec2(texX, texY), 0).r;

          float otherX = otherTreeData.r;
          float otherY = otherTreeData.g;
          float otherSize = otherTreeData.b;
          float otherMaxSize = otherTreeData.a;

          if (otherSize <= size) continue;  // Only larger trees crowd

          // Calculate shading based on aggressor tree
          float sizeRatio = otherSize / otherMaxSize;
          float maxDistance = otherSpreadDist * sizeRatio;

          // Calculate distance
          float dx = otherX - position.x;
          float dy = otherY - position.y;
          float distanceSquared = dx * dx + dy * dy;
          float maxDistanceSquared = maxDistance * maxDistance;

          if (distanceSquared < maxDistanceSquared) {
            float distance = sqrt(distanceSquared);
            float proximity = (maxDistance - distance) / maxDistance;
            crowdednessSum += proximity * 0.6;
          }
        }

        crowdedness = min(1.0, crowdednessSum);

        // Dummy position (not rendering)
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      }
    `;

    // Fragment shader - minimal (we're not rendering)
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      out vec4 fragColor;

      void main() {
        fragColor = vec4(0.0);
      }
    `;

    // Compile shaders
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      console.error('GPU: Failed to compile shaders');
      return false;
    }

    // Create and link program with transform feedback
    this.program = this.createProgram(gl, vertexShader, fragmentShader, ['crowdedness']);

    if (!this.program) {
      console.error('GPU: Failed to link program');
      return false;
    }

    this.isInitialized = true;
    console.log('GPU acceleration initialized successfully');
    return true;
    */ // END DISABLED GPU CODE
  }

  private createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      console.error(`GPU: Shader compilation error:\n${log}`);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
    varyings: string[]
  ): WebGLProgram | null {
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    // Set up transform feedback to capture vertex shader output
    gl.transformFeedbackVaryings(program, varyings, gl.SEPARATE_ATTRIBS);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      console.error(`GPU: Program linking error:\n${log}`);
      gl.deleteProgram(program);
      return null;
    }

    // Verify transform feedback varyings were set up correctly
    const numVaryings = gl.getProgramParameter(program, gl.TRANSFORM_FEEDBACK_VARYINGS);
    console.log(`GPU: Transform feedback varyings count: ${numVaryings}`);
    for (let i = 0; i < numVaryings; i++) {
      const varying = gl.getTransformFeedbackVarying(program, i);
      if (varying) {
        console.log(`GPU: Varying ${i}: ${varying.name}, type: ${varying.type}, size: ${varying.size}`);
      }
    }

    return program;
  }

  /**
   * Calculate crowdedness for all trees using GPU
   * Returns null if GPU is not available (caller should use CPU fallback)
   */
  calculate(
    trees: Tree[],
    getMaxSize: (tree: Tree) => number,
    getSpreadDistance: (tree: Tree) => number
  ): number[] | null {
    // GPU logic broken; do not use - always return null to use CPU fallback
    return null;

    /* DISABLED - GPU transform feedback broken
    if (!this.isInitialized || !this.gl || !this.program) {
      return null; // GPU not available, use CPU
    }

    const gl = this.gl;
    const numTrees = trees.length;

    if (numTrees === 0) return [];

    // CRITICAL: Clear WebGL state from previous frame
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Clear any pending errors
    gl.getError();

    // Pack all tree data into textures (for random access in shader)
    // Texture 1 (RGBA): [x, y, size, maxSize] per tree
    // Texture 2 (R): [spreadDistance] per tree
    const textureWidth = Math.ceil(Math.sqrt(numTrees));
    const textureSize = textureWidth * textureWidth;
    const textureData = new Float32Array(textureSize * 4);
    const spreadData = new Float32Array(textureSize);

    for (let i = 0; i < numTrees; i++) {
      const idx = i * 4;
      textureData[idx + 0] = trees[i].x;
      textureData[idx + 1] = trees[i].y;
      textureData[idx + 2] = trees[i].size;
      textureData[idx + 3] = getMaxSize(trees[i]);
      spreadData[i] = getSpreadDistance(trees[i]);
    }

    // Create and upload main texture (x, y, size, maxSize)
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      textureWidth,
      textureWidth,
      0,
      gl.RGBA,
      gl.FLOAT,
      textureData
    );

    let mainTexError = gl.getError();
    if (mainTexError !== gl.NO_ERROR) {
      console.error(`GPU: Error creating main texture: ${mainTexError}`);
      return null;
    }

    // Create and upload spread distance texture (using RGBA32F for better compatibility)
    gl.activeTexture(gl.TEXTURE1);
    const spreadTexture = gl.createTexture();
    if (!spreadTexture) {
      console.error('GPU: Failed to create spread texture');
      return null;
    }
    gl.bindTexture(gl.TEXTURE_2D, spreadTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Convert spread data to RGBA format (store in R channel, rest zeros)
    const spreadTextureData = new Float32Array(textureSize * 4);
    for (let i = 0; i < numTrees; i++) {
      spreadTextureData[i * 4] = spreadData[i];  // R channel
      spreadTextureData[i * 4 + 1] = 0;  // G channel
      spreadTextureData[i * 4 + 2] = 0;  // B channel
      spreadTextureData[i * 4 + 3] = 0;  // A channel
    }

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      textureWidth,
      textureWidth,
      0,
      gl.RGBA,
      gl.FLOAT,
      spreadTextureData
    );

    const texError = gl.getError();
    if (texError !== gl.NO_ERROR) {
      console.error(`GPU: Error creating spread texture: ${texError}`);
      return null;
    }

    // Prepare input attributes for each tree
    const positions = new Float32Array(numTrees * 2);
    const sizes = new Float32Array(numTrees);
    const spreadDistances = new Float32Array(numTrees);
    const maxSizes = new Float32Array(numTrees);

    for (let i = 0; i < numTrees; i++) {
      positions[i * 2 + 0] = trees[i].x;
      positions[i * 2 + 1] = trees[i].y;
      sizes[i] = trees[i].size;
      spreadDistances[i] = getSpreadDistance(trees[i]);
      maxSizes[i] = getMaxSize(trees[i]);
    }

    // Create and upload vertex buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const sizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

    const spreadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, spreadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, spreadDistances, gl.STATIC_DRAW);

    const maxSizeBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, maxSizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, maxSizes, gl.STATIC_DRAW);

    // Create output buffer for transform feedback
    const outputBuffer = gl.createBuffer();
    if (!outputBuffer) {
      console.error('GPU: Failed to create output buffer');
      return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, outputBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, numTrees * 4, gl.DYNAMIC_COPY);

    const bufferErr = gl.getError();
    if (bufferErr !== gl.NO_ERROR) {
      console.error(`GPU: Error creating output buffer: ${bufferErr}`);
      return null;
    }

    // Use program
    gl.useProgram(this.program);

    // Set up vertex attributes
    const positionLoc = gl.getAttribLocation(this.program, 'position');
    const sizeLoc = gl.getAttribLocation(this.program, 'size');
    const spreadLoc = gl.getAttribLocation(this.program, 'spreadDistance');
    const maxSizeLoc = gl.getAttribLocation(this.program, 'maxSize');

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, spreadBuffer);
    gl.enableVertexAttribArray(spreadLoc);
    gl.vertexAttribPointer(spreadLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, maxSizeBuffer);
    gl.enableVertexAttribArray(maxSizeLoc);
    gl.vertexAttribPointer(maxSizeLoc, 1, gl.FLOAT, false, 0, 0);

    // Set uniforms
    gl.uniform1i(gl.getUniformLocation(this.program, 'allTreesTexture'), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, 'spreadTexture'), 1);
    gl.uniform1i(gl.getUniformLocation(this.program, 'numTrees'), numTrees);
    gl.uniform1i(gl.getUniformLocation(this.program, 'textureWidth'), textureWidth);

    // Set up transform feedback
    const transformFeedback = gl.createTransformFeedback();
    if (!transformFeedback) {
      console.error('GPU: Failed to create transform feedback');
      return null;
    }

    // Clear any previous errors
    gl.getError();

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    let err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.error(`GPU: Error binding transform feedback: ${err}`);
      return null;
    }

    // Unbind from ARRAY_BUFFER before binding to transform feedback
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Check if outputBuffer is valid
    if (!gl.isBuffer(outputBuffer)) {
      console.error('GPU: outputBuffer is not a valid buffer');
      return null;
    }

    console.log(`GPU: Binding output buffer (${numTrees} trees, buffer size: ${numTrees * 4} bytes)`);

    // Verify buffer was created with correct size
    gl.bindBuffer(gl.ARRAY_BUFFER, outputBuffer);
    const bufferSize = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
    console.log(`GPU: Output buffer actual size: ${bufferSize} bytes`);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, outputBuffer);

    err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.error(`GPU: Error in bindBufferBase: ${err}`);
      // Check max transform feedback attributes
      const maxAttribs = gl.getParameter(gl.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS);
      console.error(`GPU: MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS = ${maxAttribs}`);
      return null;
    }

    // Execute computation (don't render pixels)
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);

    err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.error(`GPU: Error in beginTransformFeedback: ${err}`);
      gl.disable(gl.RASTERIZER_DISCARD);
      return null;
    }

    console.log(`GPU: Drawing ${numTrees} points`);
    gl.drawArrays(gl.POINTS, 0, numTrees);

    err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.error(`GPU: Error in drawArrays (numTrees=${numTrees}): ${err}`);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      return null;
    }

    console.log(`GPU: drawArrays completed successfully`);

    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);

    err = gl.getError();
    if (err !== gl.NO_ERROR) {
      console.error(`GPU: Error after endTransformFeedback: ${err}`);
      return null;
    }

    // Read results back from GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, outputBuffer);
    const results = new Float32Array(numTrees);
    console.log(`GPU: Reading ${results.byteLength} bytes from output buffer`);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, results);

    // Debug: Log first few crowdedness values and check if they're expected
    if (numTrees > 0) {
      const sample = results.slice(0, 5);
      console.log(`GPU crowdedness sample (first 5 trees):`, sample);
      const allZeros = sample.every(v => v === 0);
      const allHalf = sample.every(v => v === 0.5);
      if (allZeros) {
        console.warn(`GPU: WARNING - All values are 0! Transform feedback may not be working`);
      } else if (allHalf) {
        console.log(`GPU: Got expected debug value 0.5 - shader IS running!`);
      }
    }

    // Cleanup - unbind everything before deleting
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

    // Unbind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.deleteTexture(texture);
    gl.deleteTexture(spreadTexture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(sizeBuffer);
    gl.deleteBuffer(spreadBuffer);
    gl.deleteBuffer(maxSizeBuffer);
    gl.deleteBuffer(outputBuffer);
    gl.deleteTransformFeedback(transformFeedback);

    return Array.from(results);
    */ // END DISABLED GPU CODE
  }

  destroy() {
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.program = null;
    this.isInitialized = false;
  }
}
