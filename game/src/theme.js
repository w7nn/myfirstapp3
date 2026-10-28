// Visual identity: sunlit desert base camp. Khaki sand field, olive command bar, signal-orange actions.

export const COLORS = {
  sand: 0xd8c79c,
  sandDark: 0xc4b07f,
  tile: 0xcbb683,
  tileShade: 0xb39d68,
  olive: 0x2f3a25,
  oliveLight: 0x4a5a3a,
  ink: 0x22281b,
  paper: 0xf6f1e3,
  gold: 0xf2c14e,
  goldDark: 0xb8861f,
  signal: 0xf28c28,
  signalDark: 0xb5601a,
  disabled: 0x9a9480,
  disabledDark: 0x726d5c,
  danger: 0xc0473a,
  mergeGlow: 0x7fd36b,
  skin: 0xf1c79b,
};

export const CSS = {
  paper: '#f6f1e3',
  ink: '#22281b',
  gold: '#f2c14e',
  olive: '#2f3a25',
  oliveMuted: '#c9d1b4',
  danger: '#c0473a',
};

export const FONTS = {
  display: '"Saira Stencil One", "Arial Black", Impact, sans-serif',
  body: '"Barlow Condensed", "Arial Narrow", Arial, sans-serif',
};

// Unit plate color changes every three levels so progress reads at a glance.
const TIERS = [
  0x7f8f4e, // 1-3 field olive
  0x5b8bb0, // 4-6 steel
  0x7d5ba6, // 7-9 violet
  0x2a9d8f, // 10-12 teal
  0xc0473a, // 13-15 crimson
  0x3d4a7a, // 16-18 navy
  0xd08a2c, // 19-21 bronze
  0x8e2f5a, // 22-24 maroon
  0xd4af37, // 25-27 gold
  0x1f1f24, // 28-30 black ops
];

export function tierColor(level) {
  return TIERS[Math.min(Math.floor((level - 1) / 3), TIERS.length - 1)];
}

export const TEXT_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);
