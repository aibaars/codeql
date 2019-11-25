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

    await exec.exec(codeqlSetup.cmd, [ 'database',
                             'create', 'database_name',
                             '--language='+language]);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
