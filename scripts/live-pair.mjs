// Uses the installed GenLayer CLI's existing account flow. No keys are read here.
// node scripts/live-pair.mjs <contract> <assessment-id> <before.jpg> <after.jpg>
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [address, id, beforePath, afterPath] = process.argv.slice(2);
if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '') || !id || !beforePath || !afterPath) {
  throw new Error('Provide a contract address, assessment ID, earlier JPEG and later JPEG.');
}
const before = readFileSync(beforePath);
const after = readFileSync(afterPath);
if (before.equals(after)) throw new Error('The live visual test requires distinct images.');
for (const [label, bytes] of [['before', before], ['after', after]]) {
  if (bytes.length > 450_000) throw new Error(`${label} exceeds the contract byte limit`);
  console.log(`${label}: ${bytes.length} bytes sha256=${createHash('sha256').update(bytes).digest('hex')}`);
}
const cli = process.env.GENLAYER_CLI_ENTRY || join(process.env.APPDATA, 'npm/node_modules/genlayer/dist/index.js');
process.argv = [process.execPath, cli, 'write', address, 'assess_images',
  '--rpc', 'https://studio.genlayer.com/api', '--args', id,
  'Hurricane Katrina regional water comparison', 'New Orleans, USGS Landsat overview',
  'Compare regional visible surface-water extent only. Do not classify individual buildings. If cloud cover or resolution prevents a reliable comparison, report unclear or limited evidence and route to human review.',
  'USGS National Land Imaging Program; Public Domain; Landsat 7 April 24 and August 30, 2005; https://www.usgs.gov/media/images/hurricane-katrina-and-after-new-orleans',
  `b#${before.toString('hex')}`, `b#${after.toString('hex')}`];
await import(pathToFileURL(cli).href);
