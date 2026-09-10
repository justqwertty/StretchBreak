#!/usr/bin/env node
// StretchBreak CLI for the Cowork plugin: a thin wrapper over the shared core CLI,
// pointed at the packs vendored into this plugin by build.sh.
const path = require("path");
const cli = require(path.join(__dirname, "..", "vendor", "core", "cli.js"));
cli.main(process.argv.slice(2), { packsDir: path.join(__dirname, "..", "vendor", "packs") });
