import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as setuptools from './setup-tools';

type TracerConfig = {
    spec?: string;
    env: {[key: string]: string};
};

const CRITICAL_TRACER_VARS = new Set(
  [ 'SEMMLE_PRELOAD_libtrace',
  , 'SEMMLE_RUNNER',
  , 'SEMMLE_COPY_EXECUTABLES_ROOT',
  , 'SEMMLE_DEPTRACE_SOCKET',
  , 'SEMMLE_JAVA_TOOL_OPTIONS'
  ]);

async function tracerConfig(codeql: setuptools.CodeQLSetup, database: string, compilerSpec?: string) : Promise<TracerConfig> {
    const compilerSpecArg = compilerSpec ? [ "--compiler-spec=" + compilerSpec] : [];

    let envFile = path.resolve(database, 'working', 'env.tmp');
    await exec.exec(codeql.cmd, ['database', 'trace-command', database,
          ...compilerSpecArg,
          process.execPath, path.resolve(__dirname, 'tracer-env.js'), envFile ]
    );

    const env : {[key: string]: string} = JSON.parse(fs.readFileSync(envFile, 'utf-8'));

    const info : TracerConfig = { env: {} };
    const config = env['ODASA_TRACER_CONFIGURATION'];
    info.spec = config;
    // Extract critical tracer variables from the environment
    for (let entry of Object.entries(env)) {
        const key = entry[0];
        const value = entry[1];
        // skip ODASA_TRACER_CONFIGURATION as it is handled separately
        if (key == 'ODASA_TRACER_CONFIGURATION') {
            continue;
        }
        // skip undefined values
        if (typeof value === 'undefined') {
            continue;
        }
        // Keep variables that do not exist in current environment. In addition always keep 
        // critical and CODEQL_ variables
        if(typeof process.env[key] === 'undefined' || CRITICAL_TRACER_VARS.has(key) || key.startsWith('CODEQL_')) {
            info.env[key] = value; 
        }
    }
    return info;
}

async function run() {
  try {
    const language = core.getInput('language', { required: true });
    const sourceRoot = path.resolve();

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();
   
    let workspaceFolder = process.env['RUNNER_WORKSPACE'];
    if (! workspaceFolder)
      workspaceFolder = path.resolve('..');
    const databaseFolder = path.resolve(workspaceFolder, 'database');
    await exec.exec(codeqlSetup.cmd, ['database', 'init', databaseFolder, '--language=' + language, '--source-root=' + sourceRoot ]);

    const mainTracerConfig = await tracerConfig(codeqlSetup, databaseFolder);
    const dockerTracerConfig = await tracerConfig(codeqlSetup, databaseFolder, path.resolve(__dirname, '..', 'src', 'docker-compiler-settings'));
    
    if (mainTracerConfig.spec && dockerTracerConfig.spec) {
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
        //core.exportVariable('SEMMLE_HANDLE_STATIC_BINARIES', 'true');
        //core.exportVariable('SEMMLE_RUNNER', path.join(codeqlSetup.tools, codeqlSetup.platform, 'runner'));
        core.exportVariable('CODEQL_ACTION_TRACER_CONFIGURATION', mainTracerConfig.spec);
    } else {
        let extractorPath = '';
        await exec.exec(codeqlSetup.cmd, ['resolve', 'extractor', '--format=json', '--language=' + language],
                        { silent: true,
                          listeners: 
                           { stdout: (data: Buffer) => { extractorPath += data.toString(); },
                             stderr: (data: Buffer) => { process.stderr.write(data); }
                           }
                         });
    
        const ext = process.platform == 'win32' ? '.cmd' : '.sh';
        core.exportVariable('CODEQL_ACTION_TRACE_CMD', path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext));
    }

    // TODO: make this a "private" environment variable of the action
    core.exportVariable('CODEQL_ACTION_DB', databaseFolder);
    core.exportVariable('CODEQL_ACTION_CMD', codeqlSetup.cmd);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
