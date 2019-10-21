import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  try {
    const language = 'cpp';

    const version = '1.0.0';
    const codeqlURL = core.getInput('tools', { required: true });
    const licenseURL = core.getInput('license', { required: true });

    core.startGroup('Setup CodeQL tools');
    let codeqlFolder = toolcache.find('CodeQL', version);
    if (codeqlFolder) {
      core.debug(`CodeQL found in cache ${codeqlFolder}`);
    } else {
      const codeqlPath = await toolcache.downloadTool(codeqlURL);
      const codeqlExtracted = await toolcache.extractZip(codeqlPath);
      codeqlFolder = await toolcache.cacheDir(codeqlExtracted, 'CodeQL', version);
    }
    core.endGroup();
   
    const codeqlDist = path.join(codeqlFolder, 'odasa');
    const codeqlTools = path.join(codeqlDist, 'tools');
    const codeqlOdasa = path.join(codeqlTools, 'odasa');
    const tracerConf = path.resolve('tracer.conf');
    const snapshotFolder = path.resolve('project', 'snapshot');

    const licensePath = await toolcache.downloadTool(licenseURL);
    await io.mkdirP(path.join(codeqlDist, 'license'));
    await io.cp(licensePath, path.join(codeqlDist, 'license', 'license.dat'));

    const compilerSettings = path.join(codeqlTools, 'c-compiler-settings-' + (process.platform == 'win32' ? 'win' : 'unix'));
    // Generate tracer configuration
    await exec.exec(
       'java', 
       [ '-cp', 
         path.join(codeqlTools, 'odasa.jar'), 
         'com.semmle.util.io.CompilerReplacementConfigParser', 
         compilerSettings,
         tracerConf
       ]);

    var data = fs.readFileSync(tracerConf, 'utf8');
    // patch up slashes
    if (process.platform != 'win32') {
      data = data.replace(new RegExp('\\\\', 'g'), '/');
    }
    data = data.replace(new RegExp('\\{0\\}', 'g'), codeqlDist);
    data = data.replace(new RegExp('\\{1\\}', 'g'), path.resolve('build-tracer.log'));
    fs.writeFileSync(tracerConf, data);

    await exec.exec(codeqlOdasa, [ 'createProject', 'project', '--language', language]);
    await exec.exec(codeqlOdasa, 
                           [ 'addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date', 
                             '--build', 'true', '--checkout', 'true', '--overwrite', 
                             '--source-location', path.resolve('.')
                           ]);

    if (process.platform == 'darwin') {
       core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlTools, 'libtrace.dylib'));
       // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
       io.mkdirP('/private/tmp/semmle-c-tracer');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
    } else if (process.platform == 'win32') {
       await exec.exec('powershell', [ 'src\\inject-tracer.ps1' ], {env: {'ODASA_TRACER_CONFIGURATION': tracerConf}});
    } else {
       core.exportVariable('LD_PRELOAD', path.join(codeqlTools, '${LIB}trace.so'));
    }
    core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
    core.exportVariable('ODASA_SNAPSHOT', snapshotFolder);
    core.exportVariable('SEMMLE_DIST', codeqlDist);
    core.exportVariable('SOURCE_ARCHIVE', path.join(snapshotFolder, 'output', 'src_archive'));
    core.exportVariable('TRAP_FOLDER', path.join(snapshotFolder, 'working', 'trap'));

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
