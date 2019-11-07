"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = process.env['ODASA_TRACER_CONFIGURATION'];
const CRITICAL_TRACER_VARS = new Set(['SEMMLE_PRELOAD_libtrace',
    ,
    'SEMMLE_RUNNER',
    ,
    'SEMMLE_COPY_EXECUTABLES_ROOT',
    ,
    'SEMMLE_DEPTRACE_SOCKET',
    ,
    'SEMMLE_JAVA_TOOL_OPTIONS'
]);
if (config) {
    const info = { spec: config, env: {} };
    for (let entry of Object.entries(process.env)) {
        const key = entry[0];
        const value = entry[1];
        if (typeof value !== 'undefined' && (key.startsWith('CODEQL') || CRITICAL_TRACER_VARS.has(key))) {
            info.env[key] = value;
        }
    }
    process.stdout.write(JSON.stringify(info));
}
else {
    throw new Error('ODASA_TRACER_CONFIGURATION is not defined');
}
