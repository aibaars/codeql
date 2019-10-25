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
            const language = 'cpp';
            const version = '1.0.0';
            const codeqlURL = core.getInput('tools', { required: true });
            const licenseURL = core.getInput('license', { required: true });
            core.startGroup('Setup CodeQL tools');
            let codeqlFolder = toolcache.find('CodeQL', version);
            if (codeqlFolder) {
                core.debug(`CodeQL found in cache ${codeqlFolder}`);
            }
            else {
                const codeqlPath = yield toolcache.downloadTool(codeqlURL);
                const codeqlExtracted = yield toolcache.extractZip(codeqlPath);
                codeqlFolder = yield toolcache.cacheDir(codeqlExtracted, 'CodeQL', version);
            }
            core.endGroup();
            const codeqlDist = path.join(codeqlFolder, 'odasa');
            const codeqlTools = path.join(codeqlDist, 'tools');
            const codeqlOdasa = path.join(codeqlTools, 'odasa');
            const snapshotFolder = path.resolve('project', 'snapshot');
            const workingFolder = path.join(snapshotFolder, 'working');
            const tracerConf = path.join(workingFolder, 'tracer.config');
            const licensePath = yield toolcache.downloadTool(licenseURL);
            yield io.mkdirP(path.join(codeqlDist, 'license'));
            yield io.cp(licensePath, path.join(codeqlDist, 'license', 'license.dat'));
            yield exec.exec(codeqlOdasa, ['createProject', 'project', '--language', language]);
            yield exec.exec(codeqlOdasa, ['addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date',
                '--build', 'true', '--checkout', 'true', '--overwrite',
                '--source-location', path.resolve('.')
            ]);
            const compilerSettings = path.join(codeqlTools, 'c-compiler-settings-' + (process.platform == 'win32' ? 'win' : 'unix'));
            // Generate tracer configuration
            yield exec.exec('java', ['-cp',
                path.join(codeqlTools, 'odasa.jar'),
                'com.semmle.util.io.CompilerReplacementConfigParser',
                compilerSettings,
                tracerConf
            ]);
            var data = fs.readFileSync(tracerConf, 'utf8');
            // patch up slashes
            if (process.platform != 'win32') {
                data = data.replace(new RegExp('\\\\', 'g'), '/');
            }
            data = data.replace(new RegExp('\\{0\\}', 'g'), codeqlDist);
            data = data.replace(new RegExp('\\{1\\}', 'g'), path.join(snapshotFolder, 'log', 'build-tracer.log'));
            fs.writeFileSync(tracerConf, data);
            if (process.platform == 'darwin') {
                core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlTools, 'libtrace.dylib'));
                // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
                io.mkdirP('/private/tmp/semmle-c-tracer');
                core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
                core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
            }
            else if (process.platform == 'win32') {
                yield exec.exec('powershell', ['src\\inject-tracer.ps1'], { env: { 'ODASA_TRACER_CONFIGURATION': tracerConf } });
            }
            else {
                core.exportVariable('LD_PRELOAD', path.join(codeqlTools, '${LIB}trace.so'));
            }
            core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
            core.exportVariable('ODASA_SNAPSHOT', snapshotFolder);
            core.exportVariable('ODASA_HOME', codeqlDist);
            core.exportVariable('SOURCE_ARCHIVE', path.join(snapshotFolder, 'output', 'src_archive'));
            core.exportVariable('TRAP_FOLDER', path.join(snapshotFolder, 'working', 'trap'));
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
