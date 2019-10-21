import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path'

async function run() {
  try {
    await exec.exec('pstree', []);

    // remove CodeQL from LD_PRELOAD // TODO leave other entries unchanged
    core.exportVariable('LD_PRELOAD', '');
    delete process.env['LD_PRELOAD'];

    const codeqlDist = process.env['SEMMLE_DIST'] || 'SEMMLE_DIST';
    const codeqlOdasa = path.join(codeqlDist, 'tools', 'odasa');
    const snapshotFolder = process.env['ODASA_SNAPSHOT'] || 'ODASA_SNAPSHOT';
    
    await exec.exec(codeqlOdasa, [ 'buildSnapshot', '--skip-build', '--snapshot', snapshotFolder]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
