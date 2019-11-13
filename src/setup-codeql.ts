import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as setuptools from './setup-tools';

async function run() {
  try {
    core.startGroup('Setup CodeQL tools');
    const codeqlSetup = await setuptools.setupCodeQL();
    core.endGroup();

    core.addPath(codeqlSetup.dist);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
