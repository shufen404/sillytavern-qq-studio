import assert from 'node:assert/strict';
import fs from 'node:fs';
const settings=JSON.parse(fs.readFileSync(new URL('../default/content/settings.json',import.meta.url),'utf8'));
const {openai_max_context:context,openai_max_tokens:output}=settings.oai_settings;
assert.ok(Number.isFinite(context)&&Number.isFinite(output));
assert.ok(context>=output+1024,'First-run context must reserve at least 1024 tokens for prompts.');
assert.equal(settings.extension_settings.studio_ui.classic,false);
assert.equal(settings.extension_settings.studio_ui.appearance.layout,'qq');
console.log('PASS: first-run prompt budget and default custom UI');
