import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

async function run() {
  try {
    core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
    delete process.env['ODASA_TRACER_CONFIGURATION'];

    const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
    const databaseFolder = process.env['CODEQL_ACTION_DB'] || 'CODEQL_ACTION_DB';
    const scannedLanguagesVar = process.env['CODEQL_ACTION_SCANNED_LANGUAGES'] || '';
    const scannedLanguages = scannedLanguagesVar.split(',').map(x => x.trim()).filter(x => x.length > 0);

    for (let language of scannedLanguages) {
        let extractorPath = '';
        await exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language],
                        { silent: true,
                          listeners: 
                           { stdout: (data: Buffer) => { extractorPath += data.toString(); },
                             stderr: (data: Buffer) => { process.stderr.write(data); }
                           }
                         });
    
        const ext = process.platform == 'win32' ? '.cmd' : '.sh';
        await exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--', 
                         path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext)]);
    }

    for (let database of fs.readdirSync(databaseFolder)) {
        await exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, database)]);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
