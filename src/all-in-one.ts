import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as setuptools from './setup-tools';

async function run() {
  try {

    const language = core.getInput('language', { required: true });

    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    const buildtools = path.join(codeqlSetup.tools,'lgtm-buildtools');
    core.endGroup();

    core.startGroup('Resolve LGTM configuration');
    const out = path.resolve('out');
    await io.mkdirP(out);
    const lgtmConfig = path.join(out, 'lgtm.effective.yml');
    fs.writeFileSync(lgtmConfig,"");
    var possibleConfigLocations = [path.resolve('lgtm.yml'), path.resolve('.lgtm.yml')]
    for (let loc of possibleConfigLocations) {
        if (fs.existsSync(loc)) {
            fs.copyFileSync(loc, lgtmConfig)
            break;
        }
    }
    core.endGroup();

    core.startGroup('Prepare for CodeQL database extraction');
    const sourceLocation = path.resolve('.');
    const projectFolder = path.resolve('project');
    await io.mkdirP(projectFolder);
    const snapshotFolder = path.join(projectFolder, 'snapshot');

    ensureSemmleJavaHome(codeqlSetup.tools);
    
    await exec.exec('java', ['-jar',
                      path.join(buildtools, 'lgtmbuild.jar'),
                      buildtools,
                      projectFolder,
                      sourceLocation,
                      language,
                      lgtmConfig]);
    core.endGroup();
    
    await exec.exec(codeqlSetup.odasa, [ 'addSnapshot',
                             '--project', projectFolder,
                             '--name', 'snapshot', '--default-date',
                             '--default-build',
                             '--default-checkout',
                             '--overwrite', 
                             '--source-location', sourceLocation]);

    await exec.exec(codeqlSetup.odasa, [ 'findGeneratedCode',
                              '--prepare',
                              '--project', projectFolder,
                              snapshotFolder]);

    await exec.exec(codeqlSetup.odasa, [ 'buildSnapshot',
                                   '--fail-early', '--ignore-errors',
                                   '--overwrite',
                                   '--project', projectFolder,
                                   '--snapshot', snapshotFolder]);

    await exec.exec(codeqlSetup.odasa, [ 'findGeneratedCode',
                              '--output', path.join(projectFolder, 'generated_files.txt'),
                              '--project', projectFolder,
                              snapshotFolder])

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

function ensureSemmleJavaHome(codeQLTools : string) {
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

    core.exportVariable("SEMMLE_JAVA_HOME", path.join(codeQLTools,'java-'+platformSuffix));
  }
}