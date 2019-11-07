import * as core from '@actions/core';

const config = process.env['ODASA_TRACER_CONFIGURATION'];
if (config) {
    const info = { spec: config, env: {} };
    for (let entry of Object.entries(process.env)) {
        const key = entry[0];
        const value = entry[1];
        if (typeof value !== 'undefined' && key.startsWith('CODEQL')) {
            info.env[key] = value;
        }
    }
    process.stdout.write(JSON.stringify(info));
} else {
    throw new Error('ODASA_TRACER_CONFIGURATION is not defined');
}
