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
const exec = __importStar(require("@actions/exec"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const tmp = __importStar(require("tmp"));
const setuptools = __importStar(require("./setup-tools"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const language = 'cpp';
            const sourceRoot = path.resolve();
            core.startGroup('Setup CodeQL tools');
            const codeqlSetup = yield setuptools.setupCodeQL();
            core.endGroup();
            const databaseFolder = path.resolve('database');
            const workingFolder = path.join(databaseFolder, 'working');
            const tracerConf = path.join(workingFolder, 'tracing', 'tracer.config');
            // install docker replace script
            yield io.cp(path.join('bin', 'replace-docker.sh'), path.join(codeqlSetup.tools, 'replace-docker.sh'));
            yield exec.exec(codeqlSetup.cmd, ['database', 'init', databaseFolder, '--language=' + language, '--source-root=' + sourceRoot]);
            yield io.mkdirP(path.join(workingFolder, 'tracing'));
            yield io.mkdirP(path.join(databaseFolder, 'log'));
            const compilerTraceSettings = path.join(codeqlSetup.dist, language, 'tools', codeqlSetup.platform, 'compiler-tracing.spec');
            const dockerTraceSettings = path.join('src', 'docker-compiler-settings');
            let tracerLog = "";
            let count = 0;
            let compilerSettingsText = "";
            for (const file of [dockerTraceSettings, compilerTraceSettings]) {
                const tempFile = tmp.tmpNameSync({ 'dir': path.join(workingFolder, 'tracing') });
                // Generate tracer configuration
                yield exec.exec('java', ['-cp',
                    path.join(codeqlSetup.tools, 'codeql.jar'),
                    'com.semmle.util.io.CompilerReplacementConfigParser',
                    file,
                    tempFile
                ]);
                let data = fs.readFileSync(tempFile, 'utf8');
                // patch up slashes
                if (process.platform != 'win32') {
                    data = data.replace(new RegExp('\\\\', 'g'), '/');
                }
                data = data.replace(new RegExp('\\{0\\}', 'g'), codeqlSetup.dist);
                data = data.replace(new RegExp('\\{1\\}', 'g'), path.join(databaseFolder, 'log', 'build-tracer.log'));
                const tempLines = data.split(/\r?\n/);
                tracerLog = tempLines[0];
                count += parseInt(tempLines[1], 10);
                compilerSettingsText += tempLines.slice(2).join('\n') + '\n';
            }
            fs.writeFileSync(tracerConf, tracerLog + '\n' + count + '\n' + compilerSettingsText);
            if (process.platform == 'darwin') {
                core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'osx64', 'libtrace.dylib'));
                // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
                io.mkdirP('/private/tmp/semmle-c-tracer');
                core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
                core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
            }
            else if (process.platform == 'win32') {
                yield exec.exec('powershell', ['src\\inject-tracer.ps1'], { env: { 'ODASA_TRACER_CONFIGURATION': tracerConf } });
            }
            else {
                core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, 'linux64', '${LIB}trace.so'));
            }
            // docker may be a static binary, turning on SEMMLE_HANDLE_STATIC_BINARIES makes it traceable
            core.exportVariable('SEMMLE_HANDLE_STATIC_BINARIES', 'true');
            core.exportVariable('SEMMLE_RUNNER', path.join(codeqlSetup.tools, codeqlSetup.platform, 'runner'));
            core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
            core.exportVariable('CODEQL_DB', databaseFolder);
            core.exportVariable('CODEQL_DIST', codeqlSetup.dist);
            core.exportVariable('SOURCE_ARCHIVE', path.join(databaseFolder, 'src'));
            core.exportVariable('TRAP_FOLDER', path.join(databaseFolder, 'trap'));
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
