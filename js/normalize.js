/** Object normalization — allowlist only. */
const ALIASES = [
  { pattern: /^sewing\s+machine$/i, class: 'SEWING_MACHINE' },
  { pattern: /^obd-?ii\s+scanner$/i, class: 'OBD2_SCANNER' },
  { pattern: /^obd2\s+scanner$/i, class: 'OBD2_SCANNER' },
  { pattern: /^car\s+diagnostic\s+scanner$/i, class: 'OBD2_SCANNER' },
  { pattern: /^telescope$/i, class: 'TELESCOPE' },
  { pattern: /^binoculars$/i, class: 'BINOCULARS' },
  { pattern: /^kill\s+a\s+watt\s+meter$/i, class: 'ELECTRICITY_USAGE_METER' },
  { pattern: /^electricity\s+usage\s+meter$/i, class: 'ELECTRICITY_USAGE_METER' },
  { pattern: /^mobile\s+hotspot$/i, class: 'MOBILE_HOTSPOT' },
  { pattern: /^hotspot$/i, class: 'MOBILE_HOTSPOT' },
  { pattern: /^science\s+kit$/i, class: 'SCIENCE_STEAM_KIT' },
  { pattern: /^steam\s+kit$/i, class: 'SCIENCE_STEAM_KIT' },
  { pattern: /^guitar$/i, class: 'MUSICAL_INSTRUMENT' },
  { pattern: /^musical\s+instrument$/i, class: 'MUSICAL_INSTRUMENT' },
  { pattern: /^pressure\s+washer$/i, class: 'PRESSURE_WASHER' },
  { pattern: /^wet[-\s]?dry\s+vacuum$/i, class: 'WET_DRY_VACUUM' },
  { pattern: /^shop\s+vac$/i, class: 'WET_DRY_VACUUM' },
  { pattern: /^ladder$/i, class: 'LADDER' },
  { pattern: /^air\s+compressor$/i, class: 'AIR_COMPRESSOR' },
  { pattern: /^circular\s+saw$/i, class: 'CIRCULAR_SAW' },
  { pattern: /^reciprocating\s+saw$/i, class: 'RECIPROCATING_SAW' },
  { pattern: /^jig\s+saw$/i, class: 'JIG_SAW' },
  { pattern: /^jigsaw$/i, class: 'JIG_SAW' },
  { pattern: /^sander$/i, class: 'SANDER' },
  { pattern: /^hedge\s+trimmer$/i, class: 'HEDGE_TRIMMER' },
  { pattern: /^tiller$/i, class: 'TILLER' },
  { pattern: /^garden\s+tool$/i, class: 'GARDEN_TOOL' },
  { pattern: /^power\s+tool$/i, class: 'POWER_TOOL' },
  { pattern: /^home\s+repair\s+tool$/i, class: 'HOME_REPAIR_TOOL' },
  { pattern: /^3d\s+printer$/i, class: 'THREE_D_PRINTER' },
  { pattern: /^3d\s+printing$/i, class: 'THREE_D_PRINTER' },
  { pattern: /^3d\s+scanner$/i, class: 'THREE_D_SCANNER' },
  { pattern: /^laser\s+engraver$/i, class: 'LASER_ENGRAVER' },
  { pattern: /^vinyl\s+cutter$/i, class: 'VINYL_CUTTER' },
  { pattern: /^soldering\s+station$/i, class: 'SOLDERING_STATION' },
  { pattern: /^video\s+transfer\s+equipment$/i, class: 'VIDEO_TRANSFER_EQUIPMENT' },
  { pattern: /^ukulele$/i, class: 'UKULELE' },
  { pattern: /^fishing\s+pole$/i, class: 'FISHING_POLE' },
  { pattern: /^fishing\s+rod$/i, class: 'FISHING_POLE' },
  { pattern: /^fishing\s+kit$/i, class: 'FISHING_POLE' },
  { pattern: /^knitting\s+loom(?:\s+kit)?$/i, class: 'KNITTING_LOOM' },
  { pattern: /^portable\s+cd\s+player$/i, class: 'PORTABLE_CD_PLAYER' },
  { pattern: /^portable\s+dvd\s+player$/i, class: 'PORTABLE_DVD_PLAYER' },
  { pattern: /^book\s+club\s+(?:kit|bag)$/i, class: 'BOOK_CLUB_KIT' },
  { pattern: /^kids\s+activity\s+tablet$/i, class: 'KIDS_ACTIVITY_TABLET' },
  { pattern: /^launchpad\s+tablet$/i, class: 'KIDS_ACTIVITY_TABLET' },
  { pattern: /^board\s+game$/i, class: 'BOARD_GAME' },
];

const EXPLICITLY_UNSUPPORTED = [/^chainsaw$/i];

/**
 * @returns {{ status: 'SUPPORTED', objectClass: string } | { status: 'UNSUPPORTED', reason: string } | { status: 'UNRECOGNIZED', reason: string }}
 */
export function normalizeObject(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { status: 'UNRECOGNIZED', reason: 'empty' };
  }

  for (const rule of EXPLICITLY_UNSUPPORTED) {
    if (rule.test(trimmed)) {
      return { status: 'UNSUPPORTED', reason: 'explicitly_unsupported' };
    }
  }

  for (const { pattern, class: objectClass } of ALIASES) {
    if (pattern.test(trimmed)) {
      return { status: 'SUPPORTED', objectClass };
    }
  }

  return { status: 'UNRECOGNIZED', reason: 'not_in_allowlist' };
}
