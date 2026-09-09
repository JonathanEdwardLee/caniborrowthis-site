/** Frozen pilot ZIP centroids — only these are supported. */
export const PILOT_ZIPS = {
  '16693': { label: 'Williamsburg, PA', lat: 40.4524, lon: -78.2389 },
  '19601': { label: 'Reading, PA', lat: 40.35, lon: -75.94 },
  '35967': { label: 'Fort Payne, AL', lat: 34.4071, lon: -85.7046 },
  '01103': { label: 'Springfield, MA', lat: 42.10355, lon: -72.59026 },
  '90210': { label: 'Beverly Hills, CA', lat: 34.1031, lon: -118.4163, noApprovedSource: true },
};

export const RESULT_CLASS = {
  RELEVANT: 'RELEVANT_BORROWING_PROGRAM',
  RESOURCE: 'REGIONAL_OR_SPECIALIST_RESOURCE',
  FALLBACK: 'NEARBY_LIBRARY_TO_ASK',
};

export const RESULT_CLASS_LABEL = {
  [RESULT_CLASS.RELEVANT]: 'Relevant borrowing program',
  [RESULT_CLASS.RESOURCE]: 'Regional or specialist resource',
  [RESULT_CLASS.FALLBACK]: 'Nearby library to ask',
};

/** Frozen production source profiles — do not add others. */
export const SOURCES = [
  {
    id: 'S1_ALTOONA_TOOL',
    class: RESULT_CLASS.RELEVANT,
    url: 'https://altoonalibrary.org/services/',
    title: 'Altoona Area Public Library — Tool Lending Library',
    geographyZips: ['16693'],
    objectClasses: ['SEWING_MACHINE'],
    acceptedDistanceMi: { '16693': 10.7 },
    note: 'Official Tool Lending Library evidence includes a sewing machine; do not claim current availability.',
    reviewDate: '2026-09-08',
  },
  {
    id: 'S2_OLEY_DIAGNOSTIC',
    class: RESULT_CLASS.RELEVANT,
    url: 'https://oleyvalleylibrary.com/materials-and-services',
    title: 'Oley Valley Community Library — Car Diagnostic Scanner',
    geographyZips: ['19601'],
    objectClasses: ['OBD2_SCANNER'],
    acceptedDistanceMi: { '19601': 8.1 },
    note: 'Official materials evidence lists a Car Diagnostic Scanner; do not claim current availability.',
    reviewDate: '2026-09-08',
  },
  {
    id: 'S3_MA_LIBRARY_OF_THINGS',
    class: RESULT_CLASS.RESOURCE,
    url: 'https://libraries.state.ma.us/library-of-things-search',
    title: 'Massachusetts Library of Things Search',
    geographyZips: ['01103'],
    geographyLabel: 'Massachusetts',
    objectClasses: [
      'TELESCOPE',
      'SEWING_MACHINE',
      'ELECTRICITY_USAGE_METER',
      'MOBILE_HOTSPOT',
      'SCIENCE_STEAM_KIT',
      'MUSICAL_INSTRUMENT',
    ],
    linkOnly: true,
    note: 'Official statewide search covers broad Library of Things categories; link only — do not copy catalog results.',
    reviewDate: '2026-09-08',
  },
  {
    id: 'S4_LIBRARY_TELESCOPE_PROGRAM',
    class: RESULT_CLASS.RESOURCE,
    url: 'https://www.librarytelescope.org/world/usa',
    title: 'Library Telescope Program — Participating Libraries',
    geographyZips: null,
    objectClasses: ['TELESCOPE', 'BINOCULARS'],
    linkOnly: true,
    national: true,
    note: 'Specialist participating-library resource; do not imply a participating library is nearby until user checks destination.',
    reviewDate: '2026-09-08',
  },
  {
    id: 'S5_DEKALB_LIBRARY_FALLBACK',
    class: RESULT_CLASS.FALLBACK,
    url: 'https://dekalbcountypubliclibrary.wordpress.com/',
    title: 'DeKalb County Public Library',
    geographyZips: ['35967'],
    objectClasses: null,
    objectRelevance: 'NONE_ASSERTED',
    note: 'No relevant borrowing source is known in our current coverage; nearby official library route to ask/check.',
    reviewDate: '2026-09-08',
  },
  {
    id: 'S6_WILLIAMSBURG_LIBRARY_FALLBACK',
    class: RESULT_CLASS.FALLBACK,
    url: 'https://www.blaircountylibraries.org/libraries/',
    title: 'Blair County Libraries',
    geographyZips: ['16693'],
    objectClasses: null,
    objectRelevance: 'NONE_ASSERTED',
    note: 'Generic nearby-library fallback to ask/check; no object relevance or availability is asserted.',
    reviewDate: '2026-09-08',
  },
];
