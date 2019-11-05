import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

async function run() {
  try {
    const language = 'cpp';
    const sourceRoot = path.resolve();

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();
   
    const databaseFolder = path.resolve('database');
    const workingFolder = path.join(databaseFolder, 'working');
    const tracerConf = path.join(workingFolder, 'tracing', 'tracer.config');

    // install docker replace script
    await io.cp(path.join('bin', 'replace-docker.sh'), path.join(codeqlSetup.tools, 'replace-docker.sh'));

    await exec.exec(codeqlSetup.cmd, ['database', 'init', databaseFolder, '--language=' + language, '--source-root=' + sourceRoot ]);
    await io.mkdirP(path.join(workingFolder, 'tracing'));
    await io.mkdirP(path.join(databaseFolder, 'log'));

    const compilerSettings = path.join(codeqlSetup.dist, language, 'tools', codeqlSetup.platform, 'compiler-tracing.spec');

    // Generate tracer configuration
    await exec.exec(
       'java', 
       [ '-cp', 
         path.join(codeqlSetup.tools, 'codeql.jar'), 
         'com.semmle.util.io.CompilerReplacementConfigParser', 
         compilerSettings,
         tracerConf
       ]);

    var data = fs.readFileSync(tracerConf, 'utf8');
    // patch up slashes
    if (process.platform != 'win32') {
      data = data.replace(new RegExp('\\\\', 'g'), '/');
    }
    data = data.replace(new RegExp('\\{0\\}', 'g'), codeqlSetup.dist);
    data = data.replace(new RegExp('\\{1\\}', 'g'), path.join(databaseFolder, 'log', 'build-tracer.log'));
    fs.writeFileSync(tracerConf, data);

    if (process.platform == 'darwin') {
       core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
       // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
       io.mkdirP('/private/tmp/semmle-c-tracer');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
    } else if (process.platform == 'win32') {
       await exec.exec('powershell', [ 'src\\inject-tracer.ps1' ], {env: {'ODASA_TRACER_CONFIGURATION': tracerConf}});
    } else {
       core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, 'linux64', '${LIB}trace.so'));
    }

    // docker may be a static binary, turning on SEMMLE_HANDLE_STATIC_BINARIES makes it traceable
    core.exportVariable('SEMMLE_HANDLE_STATIC_BINARIES', 'true');
    core.exportVariable('SEMMLE_RUNNER', path.join(codeqlSetup.tools, codeqlSetup.platform, 'runner'));

    core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
    core.exportVariable('CODEQL_DB', databaseFolder);
    core.exportVariable('CODEQL_DIST', codeqlSetup.dist);
    core.exportVariable('SOURCE_ARCHIVE', path.join(databaseFolder, 'src'));
    core.exportVariable('TRAP_FOLDER', path.join(databaseFolder, 'trap'));

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
