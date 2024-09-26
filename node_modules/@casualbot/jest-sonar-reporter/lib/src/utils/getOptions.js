"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const uuid_1 = require("uuid");
const constants_1 = __importDefault(require("../constants"));
const replaceRootDirInPath_1 = require("./replaceRootDirInPath");
function getEnvOptions() {
    const options = {};
    const setupConf = constants_1.default;
    for (const name in setupConf.ENV_CONFIG_MAP) {
        if (process.env[name]) {
            options[setupConf.ENV_CONFIG_MAP[name]] = process.env[name];
        }
    }
    return options;
}
function getAppOptions(pathToResolve) {
    let traversing = true;
    while (traversing) {
        traversing = pathToResolve !== path.sep;
        const pkgpath = path.join(pathToResolve, 'package.json');
        if (fs.existsSync(pkgpath)) {
            let options = (require(pkgpath) || {})['@casualbot/jest-sonar-reporter'];
            if (Object.prototype.toString.call(options) !== '[object Object]') {
                options = {};
            }
            return options;
        }
        else {
            pathToResolve = path.dirname(pathToResolve);
        }
    }
    return {};
}
function replaceRootDirInOutput(rootDir, output) {
    return rootDir !== null ? (0, replaceRootDirInPath_1.replaceRootDirInPath)(rootDir, output) : output;
}
function getUniqueOutputName() {
    return `jest-sonar-reporter-${(0, uuid_1.v1)()}.xml`;
}
exports.default = {
    options: (reporterOptions = {}) => {
        return Object.assign({}, constants_1.default.DEFAULT_OPTIONS, reporterOptions, getAppOptions(process.cwd()), getEnvOptions());
    },
    getAppOptions: getAppOptions,
    getEnvOptions: getEnvOptions,
    replaceRootDirInOutput: replaceRootDirInOutput,
    getUniqueOutputName: getUniqueOutputName
};
