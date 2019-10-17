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
            const codeqlURL = 'https://storage.googleapis.com/semmle-oss-testing-dists/tools/dist/dcol_212509982ff59e8c7506c92d06ba093c.e461fc6238f99b10a9c0ac796d07e037.zip?x-goog-signature=21187fc1fd0c6359793f905b7359449d74dd661da5d335fbc7b7d80fbca65feb527f2de1c272b76ed3744f5eb18f1dbb878aef3e530a2b5500af502466cb2e8a718a411dbd94b0f03dc4e6eeab8a50577ef6ffca415c51ba4fbd249d1eb371ed4de39d3e3bdbe90cf8a8f0052ae5fecb2f937bcced37d72ff0dbe6539d422fc068fc740fcf1fd045196bda65e5eebb9f184b3b2251cf5f4e432f23d708813f44d77fcb5a3dd79150ea2da59f1aefc89bf8bf910d98e87c9e322d9ad87f1a992e5dcc6faad977e16f674064e5ee24f765c86fdb7d3b7a894ca671d8ccf7be4e905621d57dbd3633d1e063bac56744b84264426a78fcefdda805352deed6cbdd4b&x-goog-algorithm=GOOG4-RSA-SHA256&x-goog-credential=semmle-oss-testing%40appspot.gserviceaccount.com%2F20191011%2Fus-central1%2Fstorage%2Fgoog4_request&x-goog-date=20191011T142253Z&x-goog-expires=604800&x-goog-signedheaders=host';
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
            const licenseURL = 'https://storage.googleapis.com/semmle-oss-testing/tools/license.dat?x-goog-signature=672dfcd6c97637aa1a7f1404f04d2b521c7690b5933e5fdbb9430839ae8edab60ab74637a8b95adfcbbf3b038b93a2422d02d7f157b04440dde14241f7bda505d8f06f9289dd18b3b1ec32315cce3f382264079f830c71ca4ddee185b60b595957afed2a9a2db365170738b114e2ab08a4eb6d904e741b516b737489fe9f6e3b55bca45fca99b317bb5b99b5e0ab9c62b21fdf157a497ac6c1bd3fff3576c1b0f5a486f2e6cd631e144b300c663e12a1f1b9e5cf9ee4817ec2f3dca113ddc0adb1d294f6fb666608e297bb930b09a042270c6e674091d031a304d593094f2ebdc36dfb60e0e25d9ea4841267963b1a6aeee609820ded8bc566eb920179c98be4&x-goog-algorithm=GOOG4-RSA-SHA256&x-goog-credential=semmle-oss-testing%40appspot.gserviceaccount.com%2F20191013%2Fus-central1%2Fstorage%2Fgoog4_request&x-goog-date=20191013T090238Z&x-goog-expires=604800&x-goog-signedheaders=host';
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
