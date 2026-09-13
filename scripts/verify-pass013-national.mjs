import {
  runPass013Verification,
  writeEvidence,
  PROBE_COUNT,
  CENTER_COUNT,
} from '../tests/helpers/pass013-verify.mjs';

const { report, zipProbes, geoRows } = await runPass013Verification();
writeEvidence({ report, zipProbes, geoRows });

console.log(
  JSON.stringify(
    {
      matrix: report.matrix,
      zipProbes: `${report.zipProbeCount}/${PROBE_COUNT}`,
      geo: `${report.geoCount}/${CENTER_COUNT}`,
      pass: report.pass,
      fail: report.fail,
      hold: report.hold,
      failures: report.failures,
      edges: report.edges,
    },
    null,
    2,
  ),
);

if (report.fail > 0 || report.zipProbeCount !== PROBE_COUNT || report.geoCount !== CENTER_COUNT) {
  process.exitCode = 1;
}
