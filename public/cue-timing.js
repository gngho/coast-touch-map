// The server supplies one future onset. Each browser maps it to its monotonic
// clock using the response timestamp and half the measured request round trip.
export function cueDelay(snapshot,now=performance.now()){
  if(!Number.isFinite(snapshot?.state?.cueAt))return 0;
  const timing=snapshot._timing;
  const serverNow=snapshot.serverTime+(timing?Math.max(0,now-timing.receivedAt)+timing.roundTrip/2:0);
  return Math.max(0,snapshot.state.cueAt-serverNow);
}
export const scenarioLabel=value=>String(value??'').replace(/^(?:FR|BU)-(restaurant|cafe|weather|road)$/,'$1');
