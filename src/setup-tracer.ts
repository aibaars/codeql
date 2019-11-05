import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

async function run() {
  try {
    const language = 'cpp';

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();
   
    const compilerSettings = path.join(codeqlSetup.tools, 'c-compiler-settings-' + (process.platform == 'win32' ? 'win' : 'unix'));
    const tracerConf = path.resolve('tracer.conf');
    // Generate tracer configuration
    await exec.exec(
       'java', 
       [ '-cp', 
         path.join(codeqlSetup.tools, 'odasa.jar'), 
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
    data = data.replace(new RegExp('\\{1\\}', 'g'), path.resolve('build-tracer.log'));
    fs.writeFileSync(tracerConf, data);

    await exec.exec(codeqlSetup.odasa, [ 'createProject', 'project', '--language', language]);
    await exec.exec(codeqlSetup.odasa, 
                           [ 'addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date', 
                             '--build', 'true', '--checkout', 'true', '--overwrite', 
                             '--source-location', path.resolve('.')
                           ]);

    if (process.platform == 'darwin') {
       core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'libtrace.dylib'));
       // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
       io.mkdirP('/private/tmp/semmle-c-tracer');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
    } else if (process.platform == 'win32') {
       await exec.exec('powershell', [ 'src\\inject-tracer.ps1' ], {env: {'ODASA_TRACER_CONFIGURATION': tracerConf}});
    } else {
       core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, '${LIB}trace.so'));
    }
    
    core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
    core.exportVariable('SEMMLE_DIST', codeqlSetup.dist);
    const snapshotFolder = path.resolve('project', 'snapshot');
    core.exportVariable('ODASA_SNAPSHOT', snapshotFolder);
    core.exportVariable('SOURCE_ARCHIVE', path.join(snapshotFolder, 'output', 'src_archive'));
    core.exportVariable('TRAP_FOLDER', path.join(snapshotFolder, 'working', 'trap'));

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
