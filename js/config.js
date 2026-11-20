export const IS_MOBILE_RENDER=matchMedia('(pointer:coarse)').matches || innerWidth<768;
export const ARTWORK_HOLD_MS=24*60*60*1000;
export const PRESENCE_PULSE_MS=1000;
export const PRESENCE_POLL_MS=2500;
export const HEARTBEAT_MS=5000;
export const SNOW_COUNT=IS_MOBILE_RENDER?420:850;
