// Dependency-free WebGL: deforming 3D ribbon meshes, glass shell and bloom.
// One GPU context is shared by all previews. No audio or experiment events here.
const vertex = `
attribute vec2 aPosition;
varying vec2 uv;
void main(){uv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const shellFragment = `
precision mediump float;
varying vec2 uv;
uniform float uTime,uCue,uListening;
void main(){
 vec2 p=(uv-.5)*2.;float r=length(p);float edge=.79;
 vec3 blue=vec3(.19,.63,1.);vec3 pink=vec3(.97,.36,.74);
 vec3 col=mix(blue,pink,.5+.5*sin(atan(p.y,p.x)+.7));
 float rim=exp(-pow((r-edge)*170.,2.));
 float halo=exp(-pow((r-edge)*19.,2.));
 float inside=1.-smoothstep(edge-.005,edge,r);
 vec3 light=col*(rim*.8+halo*.11);
 light+=inside*vec3(.016,.023,.055);
 float glint=exp(-pow((r-.764)*95.,2.))*pow(max(0.,dot(normalize(p+vec2(.001)),normalize(vec2(-.7,.8)))),22.);
 light+=vec3(.58,.9,1.)*glint*.8;
 float lower=exp(-pow((r-.768)*110.,2.))*pow(max(0.,dot(normalize(p+vec2(.001)),normalize(vec2(.5,-.8)))),30.);
 light+=vec3(.9,.47,.79)*lower*.5;
 // Rear effects emerge from behind the sphere and fade before the canvas edge.
 float behind=smoothstep(edge-.012,edge+.008,r);
 float boundary=1.-smoothstep(.95,.995,r);
 float breath=.65+.35*sin(uTime*2.1);
 float aura=exp(-pow((r-edge-.045)/(.13+.025*breath),2.));
 vec3 auraColor=mix(vec3(.38,.55,1.),vec3(.87,.48,1.),.5+.5*p.y);
 light+=auraColor*aura*(.35+.23*breath)*uCue*behind*boundary;
 // Two soft spherical wavefronts travel outwards; no star-shaped accents.
 for(int i=0;i<2;i++){
  float phase=fract(uTime*.48+float(i)*.5);
  float radius=edge+.185*phase;
  float wave=exp(-pow((r-radius)/(.009+.006*phase),2.));
  float fade=sin(phase*3.14159)*(1.-phase);
  light+=vec3(.3,.75,1.)*wave*fade*.48*uListening*behind*boundary;
 }
 gl_FragColor=vec4(light,1.);
}`;
const ribbonVertex = `
precision mediump float;
attribute vec2 aPosition;
uniform float uTime,uLayer,uEnergy,uSpeed;
varying vec3 vPosition,vNormal;
varying float vAcross,vAlong;
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
vec3 surface(float u,float v){
 float t=uTime*uSpeed;float k=uLayer*1.2566;
 float wobble=sin(u*3.+t*.83+k)*.075+sin(u*5.-t*.64+k*2.)*.025;
 float radius=.56+wobble*uEnergy;
 float width=(.13+.065*sin(u*2.-t+k))*(.75+uEnergy*.25);
 float twist=u*2.+t*.37+k;
 vec3 p=vec3(cos(u)*(radius+v*width*cos(twist)),sin(u)*(radius+v*width*cos(twist)),
  sin(u*2.+t*.6+k)*(.15+.09*uEnergy)+v*width*sin(twist));
 p=rx(k*.73+.35*sin(t*.24+k))*p;
 p=ry(k*.48+t*.18)*p;
 p.y+=.07*sin(t*.5+k);p.x+=.045*cos(t*.43+k);
 return p;
}
void main(){
 float u=aPosition.x,v=aPosition.y;
 vec3 p=surface(u,v);
 vec3 du=surface(u+.005,v)-p;vec3 dv=surface(u,v+.005)-p;
 vNormal=normalize(cross(du,dv));vPosition=p;vAcross=v;vAlong=u;
 float perspective=2.9/(2.9-p.z);
 gl_Position=vec4(p.xy*perspective*.91,-p.z*.3,1.);
}`;
const ribbonFragment = `
precision mediump float;
uniform float uLayer,uTime,uEnergy;
varying vec3 vPosition,vNormal;
varying float vAcross,vAlong;
void main(){
 float screenRadius=length(vPosition.xy*(2.9/(2.9-vPosition.z))*.91);
 if(screenRadius>.786)discard;
 vec3 n=normalize(vNormal);float facing=abs(n.z);
 vec3 cyan=vec3(.06,.79,1.);vec3 violet=vec3(.42,.25,1.);vec3 pink=vec3(1.,.19,.59);
 float shift=.5+.5*sin(vAlong*.8+uLayer*1.5+uTime*.14);
 vec3 color=mix(cyan,violet,smoothstep(.1,.65,shift));color=mix(color,pink,smoothstep(.5,1.,shift));
 float edge=pow(abs(vAcross),12.);
 float shine=pow(abs(dot(n,normalize(vec3(-.4,.6,1.)))),18.);
 float folds=.5+.5*sin(vAlong*6.+vAcross*3.+uTime*.4+uLayer);
 float alpha=(1.-smoothstep(.78,1.,abs(vAcross)))*(.27+.28*facing);
 alpha*=1.-smoothstep(.76,.786,screenRadius);
 float depth=.7+.3*(vPosition.z+.8)/1.6;
 vec3 light=color*(.42+.36*facing+.14*folds)*depth;
 light+=mix(color,vec3(.8,.95,1.),.6)*(edge*.8+shine*.5);
 gl_FragColor=vec4(light,alpha);
}`;
const compositeFragment = `
precision mediump float;
varying vec2 uv;
uniform sampler2D uImage;
uniform vec2 uPixel;
void main(){
 vec3 base=texture2D(uImage,uv).rgb;vec3 bloom=vec3(0.);
 for(int i=0;i<12;i++){
  float a=float(i)*.523599;vec2 d=vec2(cos(a),sin(a))*uPixel;
  bloom+=texture2D(uImage,uv+d*5.).rgb*.045;
  bloom+=texture2D(uImage,uv+d*12.).rgb*.022;
 }
 vec3 c=base+bloom*.65;
 c=vec3(1.)-exp(-c*1.55);
 gl_FragColor=vec4(c,max(max(c.r,c.g),c.b));
}`;

export class GlassRenderer {
  constructor(targets) {
    this.canvas=document.createElement('canvas');
    this.canvas.width=this.canvas.height=400;
    this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true});
    if(!this.gl) throw new Error('이 브라우저에서 WebGL을 사용할 수 없습니다.');
    this.targets=targets.map(({canvas,state})=>({canvas,ctx:canvas.getContext('2d'),state,energy:.45,speed:.4,cue:0,listening:0}));
    this.motion=matchMedia('(prefers-reduced-motion: reduce)');
    this.time=0;this.last=0;this.frame=0;this.disposed=false;this.lost=false;
    this.onLost=e=>{e.preventDefault();this.lost=true;cancelAnimationFrame(this.frame);};
    this.onRestore=()=>{this.lost=false;this.init();this.last=0;this.frame=requestAnimationFrame(this.tick);};
    this.canvas.addEventListener('webglcontextlost',this.onLost);
    this.canvas.addEventListener('webglcontextrestored',this.onRestore);
    this.init();this.tick=this.tick.bind(this);this.frame=requestAnimationFrame(this.tick);
  }
  program(vs,fs){
    const gl=this.gl,p=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error);}
      gl.attachShader(p,s);gl.deleteShader(s);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    const uniforms={};for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){const name=gl.getActiveUniform(p,i).name;uniforms[name]=gl.getUniformLocation(p,name);}
    return {p,uniforms,position:gl.getAttribLocation(p,'aPosition')};
  }
  init(){
    const gl=this.gl;
    this.shell=this.program(vertex,shellFragment);this.ribbon=this.program(ribbonVertex,ribbonFragment);this.composite=this.program(vertex,compositeFragment);
    this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const points=[],segments=160,across=8;
    for(let i=0;i<segments;i++)for(let j=0;j<across;j++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,c=j/across*2-1,d=(j+1)/across*2-1;
      points.push(a,c,b,c,a,d,a,d,b,c,b,d);
    }
    this.count=points.length/2;this.mesh=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,400,400,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('WebGL framebuffer incomplete');
  }
  use(program,buffer){const gl=this.gl;gl.useProgram(program.p);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(program.position);gl.vertexAttribPointer(program.position,2,gl.FLOAT,false,0,0);}
  draw(target,dt){
    const gl=this.gl;
    const settings={idle:[.45,.4,0],listening:[.95,.7,0],thinking:[.8,1.35,0],speaking:[1.65,1.15,0],twinkle:[.85,.65,1]};
    const [energy,speed,cue]=settings[target.state]||settings.idle;
    const ease=1-Math.exp(-dt*7);
    target.energy+=(energy-target.energy)*ease;target.speed+=(speed-target.speed)*ease;target.cue+=(cue-target.cue)*ease;
    target.listening+=((target.state==='listening'?1:0)-target.listening)*ease;
    target.phase=(target.phase||0)+(this.motion.matches?0:dt*target.speed);
    const t=this.motion.matches?1.7:target.phase;
    const pulse=target.state==='speaking'?.25*Math.sin(t*8)+.13*Math.sin(t*13):target.state==='listening'?.16*Math.sin(t*3):0;
    gl.viewport(0,0,400,400);gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    this.use(this.shell,this.quad);gl.uniform1f(this.shell.uniforms.uTime,t);gl.uniform1f(this.shell.uniforms.uCue,target.cue);gl.uniform1f(this.shell.uniforms.uListening,target.listening);gl.drawArrays(gl.TRIANGLES,0,6);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    this.use(this.ribbon,this.mesh);gl.uniform1f(this.ribbon.uniforms.uTime,t);gl.uniform1f(this.ribbon.uniforms.uSpeed,1);gl.uniform1f(this.ribbon.uniforms.uEnergy,target.energy+pulse);
    for(let layer=0;layer<5;layer++){gl.uniform1f(this.ribbon.uniforms.uLayer,layer);gl.drawArrays(gl.TRIANGLES,0,this.count);}
    gl.disable(gl.BLEND);gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.use(this.composite,this.quad);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(this.composite.uniforms.uImage,0);gl.uniform2f(this.composite.uniforms.uPixel,1/400,1/400);gl.drawArrays(gl.TRIANGLES,0,6);
    target.ctx.clearRect(0,0,target.canvas.width,target.canvas.height);target.ctx.drawImage(this.canvas,0,0,target.canvas.width,target.canvas.height);
  }
  tick(now){
    if(this.disposed||this.lost)return;
    this.frame=requestAnimationFrame(this.tick);
    if(document.hidden){this.last=now;return;}
    if(now-this.last<32)return;
    const dt=Math.min((now-this.last)/1000||.033,.1);this.last=now;this.time+=dt;
    this.targets.forEach((target,i)=>{if(i===0||Math.floor(this.time*15)!==target.lastFrame){this.draw(target,i===0?dt:Math.min((this.time-(target.lastTime||this.time-dt)),.2));target.lastFrame=Math.floor(this.time*15);target.lastTime=this.time;}});
  }
  setState(state){this.targets[0].state=state;}
  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frame);const gl=this.gl;
    [this.shell,this.ribbon,this.composite].forEach(p=>gl.deleteProgram(p.p));[this.mesh,this.quad].forEach(b=>gl.deleteBuffer(b));gl.deleteTexture(this.texture);gl.deleteFramebuffer(this.fbo);
    this.canvas.removeEventListener('webglcontextlost',this.onLost);this.canvas.removeEventListener('webglcontextrestored',this.onRestore);
  }
}
