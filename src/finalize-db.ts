import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path'
import * as setuptools from './setup-tools';

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

    const databaseFolder = process.env['CODEQL_ACTION_DB'] || 'CODEQL_ACTION_DB';
    const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
    const traceCmd = process.env['CODEQL_ACTION_TRACE_CMD'];
    if (traceCmd) {
        await exec.exec(codeqlCmd, ['database', 'trace-command', databaseFolder, '--', traceCmd]);
    }
    await exec.exec(codeqlCmd, ['database', 'finalize', databaseFolder]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
