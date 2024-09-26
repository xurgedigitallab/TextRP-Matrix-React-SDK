declare function getEnvOptions(): any;
declare function getAppOptions(pathToResolve: any): any;
declare function replaceRootDirInOutput(rootDir: any, output: any): any;
declare function getUniqueOutputName(): string;
declare const _default: {
    options: (reporterOptions?: {}) => any;
    getAppOptions: typeof getAppOptions;
    getEnvOptions: typeof getEnvOptions;
    replaceRootDirInOutput: typeof replaceRootDirInOutput;
    getUniqueOutputName: typeof getUniqueOutputName;
};
export default _default;
