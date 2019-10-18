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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const language = 'cpp';
            const version = '1.0.0';
            const codeqlURL = core.getInput('tools', { required: true });
            const licenseURL = core.getInput('license', { required: true });
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
            const tracerConf = path.resolve('tracer.conf');
            const snapshotFolder = path.resolve('project', 'snapshot');
            const licensePath = yield toolcache.downloadTool(licenseURL);
            yield io.mkdirP(path.join(codeqlDist, 'license'));
            yield io.cp(licensePath, path.join(codeqlDist, 'license', 'license.dat'));
            // Generate tracer configuration
            yield exec.exec('java', ['-cp',
                path.join(codeqlTools, 'odasa.jar'),
                'com.semmle.util.io.CompilerReplacementConfigParser',
                path.join(codeqlTools, 'c-compiler-settings'),
                tracerConf
            ]);
            // patch up slashes
            yield exec.exec('sed', ['s#\\\\#/#g#', '-i', tracerConf]);
            yield exec.exec('sed', ['s#{0}#' + path.join(codeqlFolder, 'odasa') + '#g', '-i', tracerConf]);
            yield exec.exec('sed', ['s#{1}#' + path.resolve('build-tracer.log') + '#g', '-i', tracerConf]);
            yield exec.exec(codeqlOdasa, ['createProject', 'project', '--language', language]);
            yield exec.exec(codeqlOdasa, ['addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date',
                '--build', '/bin/true', '--checkout', '/bin/true', '--overwrite',
                '--source-location', path.resolve('.')
            ]);
            core.exportVariable('LD_PRELOAD', path.join(codeqlTools, '${LIB}trace.so'));
            core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
            core.exportVariable('ODASA_SNAPSHOT', snapshotFolder);
            core.exportVariable('SEMMLE_DIST', codeqlDist);
            core.exportVariable('SOURCE_ARCHIVE', path.join(snapshotFolder, 'output', 'src_archive'));
            core.exportVariable('TRAP_FOLDER', path.join(snapshotFolder, 'working', 'trap'));
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
