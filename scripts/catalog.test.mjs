import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const script = name => fileURLToPath(new URL(name, import.meta.url));

test('the playable catalog ships one small, decodable H’Mông cộc model with all gameplay motions', async () => {
  await exec(process.execPath, [script('validate-web-assets.mjs')]);
  await exec(process.execPath, [script('check-web-models.mjs')]);
});
