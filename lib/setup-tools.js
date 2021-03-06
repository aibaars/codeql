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
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class CodeQLSetup {
    constructor(codeqlDist, cmd) {
        this.dist = codeqlDist;
        this.tools = path.join(this.dist, 'tools');
        this.cmd = cmd;
        // TODO check process.arch ?
        if (process.platform == 'win32') {
            this.platform = 'win64';
            if (this.cmd.endsWith('codeql')) {
                this.cmd += ".cmd";
            }
        }
        else if (process.platform == 'linux') {
            this.platform = 'linux64';
        }
        else if (process.platform == 'darwin') {
            this.platform = 'osx64';
        }
        else {
            throw new Error("Unsupported plaform: " + process.platform);
        }
    }
}
exports.CodeQLSetup = CodeQLSetup;
function setupCodeQL() {
    return __awaiter(this, void 0, void 0, function* () {
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
        let codeqlDist = path.join(codeqlFolder, 'codeql');
        let cmd = path.join(codeqlDist, 'codeql');
        // TODO: remove ODASA-mode
        if (fs.existsSync(path.join(codeqlFolder, 'odasa'))) {
            codeqlDist = path.join(codeqlFolder, 'odasa');
            cmd = path.join(codeqlDist, 'tools', 'odasa');
            const licenseURL = core.getInput('license', { required: true });
            const licenseDir = path.join(codeqlDist, 'license');
            yield io.mkdirP(licenseDir);
            const licensePath = yield toolcache.downloadTool(licenseURL);
            yield io.cp(licensePath, path.join(licenseDir, 'license.dat'));
        }
        return new CodeQLSetup(codeqlDist, cmd);
    });
}
exports.setupCodeQL = setupCodeQL;
