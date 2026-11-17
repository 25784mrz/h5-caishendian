let controller = null;

export function startAmbient() {
  if (controller) {
    controller.setOn(true);
    return controller;
  }
  const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContext) return { setOn() {} };
  const audio = new AudioContext();
  const noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const master = audio.createGain();
  master.gain.value = 0.015;
  master.connect(audio.destination);
  const hiss = audio.createBufferSource();
  hiss.buffer = noise;
  hiss.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  hiss.connect(filter).connect(master);
  hiss.start();
  setInterval(() => {
    const burst = audio.createBufferSource();
    burst.buffer = noise;
    const pop = audio.createGain();
    pop.gain.setValueAtTime(0.08, audio.currentTime);
    pop.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.2);
    burst.connect(pop).connect(master);
    burst.start();
    burst.stop(audio.currentTime + 0.2);
  }, 6000);
  controller = {
    setOn(on) {
      master.gain.value = on ? 0.015 : 0;
    },
  };
  return controller;
}
