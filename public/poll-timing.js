// Keep stimulus/activation polling unchanged. Idle pages still heartbeat well
// inside the 5 s warning and 10 s disconnect thresholds.
export function pollDelay(snapshot){
  return ['prepared','running'].includes(snapshot?.state?.trial?.status)?150:1000;
}
