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
