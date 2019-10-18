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

    let codeqlFolder = toolcache.find('CodeQL', version);
    if (codeqlFolder) {
      core.debug(`CodeQL found in cache ${codeqlFolder}`);
    } else {
      const codeqlPath = await toolcache.downloadTool(codeqlURL);
      const codeqlExtracted = await toolcache.extractZip(codeqlPath);
      codeqlFolder = await toolcache.cacheDir(codeqlExtracted, 'CodeQL', version);
    }
   
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
         path.join(codeqlTools, 'c-compiler-settings'),
         tracerConf
       ]);
    // patch up slashes
    await exec.exec('sed', ['s#\\\\#/#g#', '-i', tracerConf]);
    await exec.exec('sed', ['s#{0}#' + path.join(codeqlFolder, 'odasa') + '#g', '-i', tracerConf]);
    await exec.exec('sed', ['s#{1}#' + path.resolve('build-tracer.log') + '#g', '-i', tracerConf]);
 

    await exec.exec(codeqlOdasa, [ 'createProject', 'project', '--language', language]);
    await exec.exec(codeqlOdasa, 
                           [ 'addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date', 
                             '--build', '/bin/true', '--checkout', '/bin/true', '--overwrite', 
                             '--source-location', path.resolve('.')
                           ]);

    core.exportVariable('LD_PRELOAD', path.join(codeqlTools, '${LIB}trace.so'));
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
