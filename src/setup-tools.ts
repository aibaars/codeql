import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';

export class CodeQLSetup {
    dist: string;
    tools: string;
    cmd: string;
    platform: string;

    constructor(codeqlDist : string, cmd: string) {
        this.dist = codeqlDist;
        this.tools = path.join(this.dist, 'tools');
        this.cmd = cmd;

        // TODO check process.arch ?
        if (process.platform == 'win32') {
           this.platform = 'win64';
        } else if (process.platform == 'linux') {
           this.platform = 'linux64';
        } else if (process.platform == 'darwin') {
           this.platform = 'osx64';
        } else {
           throw new Error("Unsupported plaform: " + process.platform);
        }
    }
}

export async function setupCodeQL() : Promise<CodeQLSetup> {
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

    let codeqlDist = path.join(codeqlFolder, 'codeql');
    let cmd = path.join(codeqlDist, 'codeql');

    // TODO: remove ODASA-mode
    if (fs.existsSync(path.join(codeqlFolder, 'odasa'))) {
        codeqlDist = path.join(codeqlFolder, 'odasa');
        cmd = path.join(codeqlDist, 'tools', 'odasa');
        const licenseURL = core.getInput('license', { required: true });
        const licenseDir = path.join(codeqlDist, 'license');
        await io.mkdirP(licenseDir);
        const licensePath = await toolcache.downloadTool(licenseURL);
        await io.cp(licensePath, path.join(licenseDir, 'license.dat'));
    }

    return new CodeQLSetup(codeqlDist, cmd);
}
