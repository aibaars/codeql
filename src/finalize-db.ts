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
    core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
    delete process.env['ODASA_TRACER_CONFIGURATION'];

    const codeqlDist = process.env['CODEQL_DIST'] || 'CODEQL_DIST';
    const codeqlCmd = path.join(codeqlDist, 'codeql' + (process.platform == 'win32' ? '.cmd' : ''));
    const databaseFolder = process.env['CODEQL_DB'] || 'CODEQL_DB';
    
    await exec.exec(codeqlCmd, ['database', 'finalize', databaseFolder]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
