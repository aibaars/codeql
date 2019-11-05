import * as core from '@actions/core';
import * as toolcache from '@actions/tool-cache';
import * as io from '@actions/io';
import * as path from 'path';

export class CodeQLSetup {
    dist: string;
    tools: string;
    odasa: string;

    constructor(codeqlDist : string, ) {
        this.dist = codeqlDist;
        this.tools = path.join(this.dist, 'tools');
        this.odasa = path.join(this.tools, 'odasa');
    }
}

export async function setupCodeQL() : Promise<CodeQLSetup> {
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
    const licenseDir = path.join(codeqlDist, 'license');
    await io.mkdirP(licenseDir);
    const licensePath = await toolcache.downloadTool(licenseURL);
    await io.cp(licensePath, path.join(licenseDir, 'license.dat'));
    
    return new CodeQLSetup(codeqlDist);
}