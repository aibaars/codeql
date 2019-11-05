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
const setuptools = __importStar(require("./setup-tools"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const language = 'cpp';
            core.startGroup('Setup CodeQL tools');
            const codeqlSetup = yield setuptools.setupCodeQL();
            core.endGroup();
            const snapshotFolder = path.resolve('project', 'snapshot');
            const workingFolder = path.join(snapshotFolder, 'working');
            const tracerConf = path.join(workingFolder, 'tracer.config');
            // install docker replace script
            yield io.cp(path.join('bin', 'replace-docker.sh'), path.join(codeqlSetup.tools, 'replace-docker.sh'));
            yield exec.exec(codeqlSetup.odasa, ['createProject', 'project', '--language', language]);
            yield exec.exec(codeqlSetup.odasa, ['addSnapshot', '--project', 'project', '--name', 'snapshot', '--default-date',
                '--build', 'true', '--checkout', 'true', '--overwrite',
                '--source-location', path.resolve('.')
            ]);
            const compilerSettings = path.join(codeqlSetup.tools, 'c-compiler-settings-' + (process.platform == 'win32' ? 'win' : 'unix'));
            const dockerTraceSettings = path.join('src', 'docker-compiler-settings');
            const joinedCompilerSettings = path.join(workingFolder, 'compiler-settings.txt');
            fs.writeFileSync(joinedCompilerSettings, fs.readFileSync(dockerTraceSettings, 'utf8') +
                fs.readFileSync(compilerSettings, 'utf8'));
            // Generate tracer configuration
            yield exec.exec('java', ['-cp',
                path.join(codeqlSetup.tools, 'odasa.jar'),
                'com.semmle.util.io.CompilerReplacementConfigParser',
                joinedCompilerSettings,
                tracerConf
            ]);
            var data = fs.readFileSync(tracerConf, 'utf8');
            // patch up slashes
            if (process.platform != 'win32') {
                data = data.replace(new RegExp('\\\\', 'g'), '/');
            }
            data = data.replace(new RegExp('\\{0\\}', 'g'), codeqlSetup.dist);
            data = data.replace(new RegExp('\\{1\\}', 'g'), path.join(snapshotFolder, 'log', 'build-tracer.log'));
            fs.writeFileSync(tracerConf, data);
            if (process.platform == 'darwin') {
                core.exportVariable('DYLD_INSERT_LIBRARIES', path.join(codeqlSetup.tools, 'libtrace.dylib'));
                // create parent folder of SEMMLE_COPY_EXECUTABLES_ROOT
                io.mkdirP('/private/tmp/semmle-c-tracer');
                core.exportVariable('SEMMLE_COPY_EXECUTABLES_ROOT', '/private/tmp/semmle-c-tracer/build');
                core.exportVariable('SEMMLE_COPY_EXECUTABLES', 'true');
            }
            else if (process.platform == 'win32') {
                yield exec.exec('powershell', ['src\\inject-tracer.ps1'], { env: { 'ODASA_TRACER_CONFIGURATION': tracerConf } });
            }
            else {
                core.exportVariable('LD_PRELOAD', path.join(codeqlSetup.tools, '${LIB}trace.so'));
            }
            // docker may be a static binary, turning on SEMMLE_HANDLE_STATIC_BINARIES makes it traceable
            core.exportVariable('SEMMLE_HANDLE_STATIC_BINARIES', 'true');
            const suffix = process.platform == 'darwin' ? '-osx' : process.platform == 'win32' ? '.exe' : '-linux';
            core.exportVariable('SEMMLE_RUNNER', path.join(codeqlSetup.tools, 'runner' + suffix));
            core.exportVariable('ODASA_TRACER_CONFIGURATION', tracerConf);
            core.exportVariable('ODASA_SNAPSHOT', snapshotFolder);
            core.exportVariable('ODASA_HOME', codeqlSetup.dist);
            core.exportVariable('SOURCE_ARCHIVE', path.join(snapshotFolder, 'output', 'src_archive'));
            core.exportVariable('TRAP_FOLDER', path.join(snapshotFolder, 'working', 'trap'));
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
