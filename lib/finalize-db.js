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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
            delete process.env['ODASA_TRACER_CONFIGURATION'];
            const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
            const databaseFolder = process.env['CODEQL_ACTION_DB'] || 'CODEQL_ACTION_DB';
            const scannedLanguagesVar = process.env['CODEQL_ACTION_SCANNED_LANGUAGES'] || '';
            const scannedLanguages = scannedLanguagesVar.split(',').map(x => x.trim()).filter(x => x.length > 0);
            for (let language of scannedLanguages) {
                let extractorPath = '';
                yield exec.exec(codeqlCmd, ['resolve', 'extractor', '--format=json', '--language=' + language], { silent: true,
                    listeners: { stdout: (data) => { extractorPath += data.toString(); },
                        stderr: (data) => { process.stderr.write(data); }
                    }
                });
                const ext = process.platform == 'win32' ? '.cmd' : '.sh';
                yield exec.exec(codeqlCmd, ['database', 'trace-command', path.join(databaseFolder, language), '--',
                    path.resolve(JSON.parse(extractorPath), 'tools', 'autobuild' + ext)]);
            }
            for (let database of fs.readdirSync(databaseFolder)) {
                yield exec.exec(codeqlCmd, ['database', 'finalize', path.join(databaseFolder, database)]);
                yield exec.exec(codeqlCmd, ['database', 'analyze', path.join(databaseFolder, database),
                    '--format=sarif-latest', '--output=' + path.join(databaseFolder, database) + '.sarif',
                    database + '-lgtm.qls']);
            }
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
