import { STRINGS } from "../src/i18n.js";

const en = Object.keys(STRINGS.en);
const zh = Object.keys(STRINGS.zh);
const missingZh = en.filter((k) => !STRINGS.zh[k]);
const missingEn = zh.filter((k) => !STRINGS.en[k]);
const empty = [...en, ...zh].filter((k) => !STRINGS.en[k] || !STRINGS.zh[k]);
if (missingZh.length || missingEn.length || empty.length) {
  console.log("missing in zh:", missingZh);
  console.log("missing in en:", missingEn);
  console.log("empty:", empty);
  process.exit(1);
}
console.log(`i18n OK: ${en.length} keys, 0 missing`);
