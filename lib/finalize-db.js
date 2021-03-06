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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // remove CodeQL from LD_PRELOAD // TODO leave other entries unchanged
            if (process.platform == 'darwin') {
                core.exportVariable('DYLD_INSERT_LIBRARIES', '');
                delete process.env['DYLD_INSERT_LIBRARIES'];
            }
            else if (process.platform == 'win32') {
                // TODO unload the tracer ?
            }
            else {
                core.exportVariable('LD_PRELOAD', '');
                delete process.env['LD_PRELOAD'];
            }
            core.exportVariable('ODASA_TRACER_CONFIGURATION', '');
            delete process.env['ODASA_TRACER_CONFIGURATION'];
            const databaseFolder = process.env['CODEQL_ACTION_DB'] || 'CODEQL_ACTION_DB';
            const codeqlCmd = process.env['CODEQL_ACTION_CMD'] || 'CODEQL_ACTION_CMD';
            const traceCmd = process.env['CODEQL_ACTION_TRACE_CMD'];
            if (traceCmd) {
                yield exec.exec(codeqlCmd, ['database', 'trace-command', databaseFolder, '--', traceCmd]);
            }
            yield exec.exec(codeqlCmd, ['database', 'finalize', databaseFolder]);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
