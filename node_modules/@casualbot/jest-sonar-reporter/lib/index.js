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
const xml_1 = __importDefault(require("xml"));
const mkdirp = require('mkdirp');
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const buildXmlReport_1 = __importDefault(require("./src/utils/buildXmlReport"));
const getOptions_1 = __importDefault(require("./src/utils/getOptions"));
const getOutputPath_1 = __importDefault(require("./src/utils/getOutputPath"));
const consoleBuffer = {};
const processor = (report, reporterOptions = {}, jestRootDir = null) => {
    const options = getOptions_1.default.options(reporterOptions);
    report.testResults.forEach((t, i) => {
        t.console = consoleBuffer[t.testFilePath];
    });
    const outputPath = (0, getOutputPath_1.default)(options, jestRootDir);
    mkdirp.sync(path.dirname(outputPath));
    fs.writeFileSync(outputPath, (0, xml_1.default)((0, buildXmlReport_1.default)(report, options), { declaration: false, indent: ' ' }));
    return report;
};
function JestSonar(globalConfig, options) {
    if (globalConfig.hasOwnProperty('testResults')) {
        const newConfig = JSON.stringify({
            reporters: ['@casualbot/jest-sonar-reporter']
        }, null, 2);
        return processor(globalConfig);
    }
    this._globalConfig = globalConfig;
    this._options = options;
    this.onTestResult = (test, testResult, aggregatedResult) => {
        if (testResult.console && testResult.console.length > 0) {
            consoleBuffer[testResult.testFilePath] = testResult.console;
        }
    };
    this.onRunComplete = (contexts, results) => {
        processor(results, this._options, this._globalConfig.rootDir);
    };
}
module.exports = JestSonar;
