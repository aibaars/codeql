"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const toolcache = __importStar(require("@actions/tool-cache"));
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const language = core.getInput('language', { required: true });
            const version = '1.0.0';
            const codeqlURL = core.getInput('tools', { required: true });
            let codeqlFolder = toolcache.find('CodeQL', version);
            if (codeqlFolder) {
                core.debug(`CodeQL found in cache ${codeqlFolder}`);
            }
            else {
                const codeqlPath = yield toolcache.downloadTool(codeqlURL);
                const codeqlExtracted = yield toolcache.extractZip(codeqlPath);
                codeqlFolder = yield toolcache.cacheDir(codeqlExtracted, 'CodeQL', version);
            }
            const codeqlDist = path.join(codeqlFolder, 'odasa');
            const codeqlTools = path.join(codeqlDist, 'tools');
            const codeqlOdasa = path.join(codeqlTools, 'odasa');
            const projectFolder = path.resolve('project');
            yield io.mkdirP(projectFolder);
            const snapshotFolder = path.join(projectFolder, 'snapshot');
            const licenseURL = core.getInput('license', { required: true });
            const licensePath = yield toolcache.downloadTool(licenseURL);
            yield io.mkdirP(path.join(codeqlDist, 'license'));
            yield io.cp(licensePath, path.join(codeqlDist, 'license', 'license.dat'));
            const buildtools = path.join(codeqlTools, 'lgtm-buildtools');
            const sourceLocation = path.resolve('.');
            const out = path.resolve('out');
            yield io.mkdirP(out);
            const lgtmConfig = path.join('out', 'lgtm.effective.yml');
            fs.writeFileSync(lgtmConfig, "");
            var possibleConfigLocations = [path.resolve('lgtm.yml'), path.resolve('.lgtm.yml')];
            for (let loc of possibleConfigLocations) {
                if (fs.existsSync(loc)) {
                    fs.copyFileSync(loc, lgtmConfig);
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
                core.exportVariable("SEMMLE_JAVA_HOME", path.join(codeqlTools, 'java-' + platformSuffix));
            }
            yield exec.exec('java', ['-jar',
                path.join(buildtools, 'lgtmbuild.jar'),
                buildtools,
                projectFolder,
                sourceLocation,
                language,
                lgtmConfig]);
            yield exec.exec(codeqlOdasa, ['addSnapshot', '--project', projectFolder,
                '--name', 'snapshot', '--default-date',
                '--default-build',
                '--default-checkout',
                '--overwrite',
                '--source-location', sourceLocation]);
            yield exec.exec(codeqlOdasa, ['findGeneratedCode',
                '--prepare',
                '--project', projectFolder,
                snapshotFolder]);
            yield exec.exec(codeqlOdasa, ['buildSnapshot',
                '--fail-early', '--ignore-errors',
                '--overwrite',
                '--project', projectFolder,
                '--snapshot', snapshotFolder]);
            yield exec.exec(codeqlOdasa, ['findGeneratedCode',
                '--output', path.join(projectFolder, 'generated_files.txt'),
                '--project', projectFolder,
                snapshotFolder]);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
