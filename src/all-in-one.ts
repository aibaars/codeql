import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path'
import * as fs from 'fs'

async function run() {
  try {

    const language = core.getInput('language', { required: true });

    const version = '1.0.0';
    const codeqlURL = core.getInput('tools', { required: true });

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
    const projectFolder = path.resolve('project');
    await io.mkdirP(projectFolder);
    const snapshotFolder = path.join(projectFolder, 'snapshot');

    const licenseURL = core.getInput('license', { required: true });
    const licensePath = await toolcache.downloadTool(licenseURL);
    await io.mkdirP(path.join(codeqlDist, 'license'));
    await io.cp(licensePath, path.join(codeqlDist, 'license', 'license.dat')); 

    const buildtools = path.join(codeqlTools,'lgtm-buildtools');
    const sourceLocation = path.resolve('.');
    const out = path.resolve('out');
    await io.mkdirP(out);
    const lgtmConfig = path.join('out', 'lgtm.effective.yml');
    fs.writeFileSync(lgtmConfig,"");
    var possibleConfigLocations = [path.resolve('lgtm.yml'), path.resolve('.lgtm.yml')]
    for (let loc of possibleConfigLocations) {
        if (fs.existsSync(loc)) {
            fs.copyFileSync(loc, lgtmConfig)
            break;
        }
    }

    if (!process.env.SEMMLE_JAVA_HOME) {
      let platformSuffix;
      switch (process.platform) {
        case 'darwin': {
          platformSuffix = 'osx';
          break;
        }
        case 'win32': {
          platformSuffix = 'win';
          break;
        }
        default: {
          platformSuffix = 'linux';
        }
      }

      core.exportVariable("SEMMLE_JAVA_HOME", path.join(codeqlTools,'java-'+platformSuffix));
    }

    await exec.exec('java', ['-jar',
                      path.join(buildtools, 'lgtmbuild.jar'),
                      buildtools,
                      projectFolder,
                      sourceLocation,
                      language,
                      lgtmConfig]);
    
    await exec.exec(codeqlOdasa, 
                           [ 'addSnapshot', '--project', projectFolder,
                             '--name', 'snapshot', '--default-date',
                             '--default-build',
                             '--default-checkout',
                             '--overwrite', 
                             '--source-location', sourceLocation]);

    await exec.exec(codeqlOdasa,
                            [ 'findGeneratedCode',
                              '--prepare',
                              '--project', projectFolder,
                              snapshotFolder]);

    await exec.exec(codeqlOdasa, [ 'buildSnapshot',
                                   '--fail-early', '--ignore-errors',
                                   '--overwrite',
                                   '--project', projectFolder,
                                   '--snapshot', snapshotFolder]);

    await exec.exec(codeqlOdasa,
                            [ 'findGeneratedCode',
                              '--output', path.join(projectFolder, 'generated_files.txt'),
                              '--project', projectFolder,
                              snapshotFolder])

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();