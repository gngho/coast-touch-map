// Fixed, local notification sound shared by every AI utterance.
export function createChime(context){
  const duration=.32,buffer=context.createBuffer(1,Math.round(context.sampleRate*duration),context.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++){
    const t=i/context.sampleRate;
    const envelope=Math.min(t/.006,1)*Math.exp(-t*13)*Math.min((samples.length-1-i)/(context.sampleRate*.025),1);
    samples[i]=.22*envelope*(Math.sin(2*Math.PI*880*t)+.45*Math.sin(2*Math.PI*1320*t))/1.45;
  }
  return {buffer,meta:{name:'ai-chime-v1',duration:buffer.duration}};
}
