import * as core from '@actions/core';
import * as fs from 'fs';

const config = process.env['ODASA_TRACER_CONFIGURATION'];

const CRITICAL_TRACER_VARS = new Set(
  [ 'SEMMLE_PRELOAD_libtrace',
  , 'SEMMLE_RUNNER',
  , 'SEMMLE_COPY_EXECUTABLES_ROOT',
  , 'SEMMLE_DEPTRACE_SOCKET',
  , 'SEMMLE_JAVA_TOOL_OPTIONS'
  ]);

if (config) {
    const info = { spec: config, env: {} };
    // Extract critical tracer variables and CODEQL_ variables from the environment
    for (let entry of Object.entries(process.env)) {
        const key = entry[0];
        const value = entry[1];
        if (typeof value !== 'undefined' && (key.startsWith('CODEQL') || CRITICAL_TRACER_VARS.has(key))) {
            info.env[key] = value;
        }
    }

    // Extract environment variables from environment file, these override
    // matching ones from the process.env
    // The format is:
    //   * number of entries (4 bytes little endian)
    //   * repeat number of entries times:
    //     - length (4 bytes little endian)
    //     - text (length - 1 bytes); can be split on '=' to get name and value
    //     - NUL byte
    const data : Buffer = fs.readFileSync(config + '.environment');
    var index = 0;
    const count = data.readInt32LE(0);
    index += 4;
    for (let i = 0; i < count; i++) { // >
        const len = data.readInt32LE(index);
        index += 4;
        const line = data.toString('utf-8', index, index + len - 1);
        const idx = line.indexOf('=');
        if (idx != -1) {
            info.env[line.substring(0, idx)] = line.substring(idx + 1);
        }
        index += len;
    }

    process.stdout.write(JSON.stringify(info));
} else {
    throw new Error('ODASA_TRACER_CONFIGURATION is not defined');
}

