import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path'

async function run() {
  try {
    // remove CodeQL from LD_PRELOAD // TODO leave other entries unchanged
    if (process.platform == 'darwin') {
      core.exportVariable('DYLD_INSERT_LIBRARIES', '');
      delete process.env['DYLD_INSERT_LIBRARIES'];
    } else if (process.platform == 'win32') {
      // TODO unload the tracer ?
    } else {
      core.exportVariable('LD_PRELOAD', '');
      delete process.env['LD_PRELOAD'];
    }
    const codeqlDist = process.env['ODASA_HOME'] || 'ODASA_HOME';
    const codeqlOdasa = path.join(codeqlDist, 'tools', 'odasa');
    const snapshotFolder = process.env['ODASA_SNAPSHOT'] || 'ODASA_SNAPSHOT';
    
    await exec.exec(codeqlOdasa, [ 'buildSnapshot', '--skip-build', '--snapshot', snapshotFolder]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
