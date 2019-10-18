import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path'

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

    // Generate tracer configuration
    await exec.exec(
       'java', 
       [ '-cp', 
         path.join(codeqlTools, 'odasa.jar'), 
         'com.semmle.util.io.CompilerReplacementConfigParser', 
         path.join(codeqlTools, 'c-compiler-settings-unix'),
         tracerConf
       ]);
    // patch up slashes
    await exec.exec('sed', ['-i.bak', '-e', 's#\\\\#/#g', tracerConf]);
    await exec.exec('sed', ['-i.bak', '-e', 's#{0}#' + path.join(codeqlFolder, 'odasa') + '#g', tracerConf]);
    await exec.exec('sed', ['-i.bak', '-e', 's#{1}#' + path.resolve('build-tracer.log') + '#g', tracerConf]);
 

    await exec.exec(codeqlOdasa, [ 'createProject', 'project', '--language', language]);
    await exec.exec(codeqlOdasa, 
                           [ 'addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date', 
                             '--build', 'true', '--checkout', 'true', '--overwrite', 
                             '--source-location', path.resolve('.')
                           ]);
    let libTrace = '${LIB}trace.so';
    if (process.platform == 'darwin') {
       core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlTools, 'libtrace.dylib'));
       // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
       io.mkdirP('/private/tmp/semmle-c-tracer');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
       core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
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
