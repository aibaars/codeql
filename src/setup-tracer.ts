import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as setuptools from './setup-tools';

type TracerConfig = {
    spec: string;
    env: {[key: string]: string};
};

async function tracerConfig(codeql: setuptools.CodeQLSetup, database: string, compilerSpec?: string) : Promise<TracerConfig> {
    const compilerSpecArg = compilerSpec ? [ "--compiler-spec=" + compilerSpec] : [];
    let output = '';
    await exec.exec(codeql.cmd, ['database', 'trace-command', database,
          ...compilerSpecArg,
          process.execPath, path.resolve('lib/tracer-env.js') ],
          { silent: true, listeners: 
             { stdout: (data: Buffer) => { output += data.toString(); }
             , stderr: (data: Buffer) => { process.stderr.write(data); } 
             }
          }
    );
    return JSON.parse(output);   
}

async function run() {
  try {
    const language = core.getInput('language', { required: true });
    const sourceRoot = path.resolve();

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();
   
    const databaseFolder = path.resolve('database');
    await exec.exec(codeqlSetup.cmd, ['database', 'init', databaseFolder, '--language=' + language, '--source-root=' + sourceRoot ]);

    const mainTracerConfig = await tracerConfig(codeqlSetup, databaseFolder);
    const dockerTracerConfig = await tracerConfig(codeqlSetup, databaseFolder, path.resolve('src', 'docker-compiler-settings'));

    // prepend docker config to main tracer config
    const mainLines = fs.readFileSync(mainTracerConfig.spec, 'utf8').split(/\r?\n/);
    const dockerLines = fs.readFileSync(dockerTracerConfig.spec, 'utf8').split(/\r?\n/);

    const count = parseInt(mainLines[1], 10) + parseInt(dockerLines[1], 10);
    const lines =
     [ mainLines[0], 
       count.toString(10),
       ...dockerLines.slice(2),
       ...mainLines.slice(2),
     ];
    fs.writeFileSync(mainTracerConfig.spec, lines.join('\n'));

    for (let entry of Object.entries(mainTracerConfig.env)) {
       core.exportVariable(entry[0], entry[1]);
    } 

    core.exportVariable('ODASA_TRACER_CONFIGURATION', mainTracerConfig.spec);
    if (process.platform == 'darwin') {
       core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
    } else if (process.platform == 'win32') {
       await exec.exec('powershell', [ 'src\\inject-tracer.ps1' ], {env: {'ODASA_TRACER_CONFIGURATION': mainTracerConfig.spec}});
    } else {
       core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, 'linux64', '${LIB}trace.so'));
    }

    // docker may be a static binary, turning on SEMMLE_HANDLE_STATIC_BINARIES makes it traceable
    core.exportVariable('SEMMLE_HANDLE_STATIC_BINARIES', 'true');
    core.exportVariable('SEMMLE_RUNNER', path.join(codeqlSetup.tools, codeqlSetup.platform, 'runner'));

    // TODO: make this a "private" environment variable of the action
    core.exportVariable('CODEQL_ACTION_DB', databaseFolder);
    core.exportVariable('CODEQL_ACTION_CMD', codeqlSetup.cmd);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
