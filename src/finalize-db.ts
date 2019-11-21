import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path'
import * as setuptools from './setup-tools';

async function run() {
  try {
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
