/**
 * @fileoverview Compatibility class for dot config.
 * @author Nicholas C. Zakas
 */

"use strict";

//-----------------------------------------------------------------------------
// Requirements
//-----------------------------------------------------------------------------

const path = require("path");
const environments = require("../conf/environments");
const createDebug = require("debug");
const { ConfigArrayFactory } = require("./config-array-factory");

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const debug = createDebug("eslintrc:dot-compat");
const cafactory = Symbol("cafactory");

/**
 * Translates an ESLintRC-style config object into a dot-config-style config
 * object.
 * @param {Object} eslintrcConfig An ESLintRC-style config object.
 * @param {Object} options Options to help translate the config.
 * @param {string} options.resolveConfigRelativeTo To the directory to resolve
 *      configs from.
 * @param {string} options.resolvePluginsRelativeTo The directory to resolve
 *      plugins from.
 * @returns {Object} A dot-config-style config object.
 */
function translateESLintRC(eslintrcConfig, { resolveConfigRelativeTo, resolvePluginsRelativeTo }) {

    const dotConfig = {};
    const configs = [];
    const languageOptions = {};
    const linterOptions = {};
    const keysToCopy = ["settings", "rules", "processor"];
    const languageOptionsKeysToCopy = ["globals", "parser", "parserOptions"];
    const linterOptionsKeysToCopy = ["noInlineConfig", "reportUnusedDisableDirectives"];
    const pluginEnvironments = new Map();

    // check for special settings for eslint:all and eslint:recommended:
    if (eslintrcConfig.settings) {
        if (eslintrcConfig.settings["eslint:all"] === true) {
            return ["eslint:all"];
        }

        if (eslintrcConfig.settings["eslint:recommended"] === true) {
            return ["eslint:recommended"];
        }
    }

    // copy over simple translations
    for (const key of keysToCopy) {
        if (key in eslintrcConfig && typeof eslintrcConfig[key] !== "undefined") {
            dotConfig[key] = eslintrcConfig[key];
        }
    }

    // copy over languageOptions
    for (const key of languageOptionsKeysToCopy) {
        if (key in eslintrcConfig && typeof eslintrcConfig[key] !== "undefined") {
            dotConfig.languageOptions = languageOptions;

            if (languageOptions[key] && typeof languageOptions[key] === "object") {
                languageOptions[key] = {
                    ...eslintrcConfig[key]
                };
            } else {
                languageOptions[key] = eslintrcConfig[key];

                if (key === "parser") {
                    debug(`Resolving parser '${languageOptions[key]}' relative to ${resolveConfigRelativeTo}`);
                    languageOptions[key] = eslintrcConfig[key].definition;
                }
            }
        }
    }

    // copy over linterOptions
    for (const key of linterOptionsKeysToCopy) {
        if (key in eslintrcConfig && typeof eslintrcConfig[key] !== "undefined") {
            dotConfig.linterOptions = linterOptions;
            linterOptions[key] = eslintrcConfig[key];
        }
    }

    // move ecmaVersion a level up
    if (languageOptions.parserOptions) {

        if ("ecmaVersion" in languageOptions.parserOptions) {
            languageOptions.ecmaVersion = languageOptions.parserOptions.ecmaVersion;
            delete languageOptions.parserOptions.ecmaVersion;
        }

        if ("sourceType" in languageOptions.parserOptions) {
            languageOptions.sourceType = languageOptions.parserOptions.sourceType;
            delete languageOptions.parserOptions.sourceType;
        }

        // check to see if we even need parserOptions anymore and remove it if not
        if (Object.keys(languageOptions.parserOptions).length === 0) {
            delete languageOptions.parserOptions;
        }
    }

    if (eslintrcConfig.ignorePattern) {
        configs.unshift({
            ignores: eslintrcConfig.ignorePattern.patterns
        });
    }

    // overrides
    if (eslintrcConfig.criteria) {

        for (const { includes, excludes } of eslintrcConfig.criteria.patterns) {
            if (includes) {
                dotConfig.files = includes.map(include => include.pattern);
            }

            if (excludes) {
                if (!includes) {
                    dotConfig.files = [excludes.map(exclude => `!${exclude.pattern}`)];
                } else {
                    dotConfig.ignores = excludes.map(exclude => exclude.pattern);
                }
            }

        }

    }

    // translate plugins
    if (eslintrcConfig.plugins && typeof eslintrcConfig.plugins === "object") {
        debug(`Translating plugins: ${eslintrcConfig.plugins}`);

        dotConfig.plugins = {};

        for (const pluginName of Object.keys(eslintrcConfig.plugins)) {

            debug(`Translating plugin: ${pluginName}`);
            debug(`Resolving plugin '${pluginName} relative to ${resolvePluginsRelativeTo}`);

            const plugin = eslintrcConfig.plugins[pluginName].definition;

            dotConfig.plugins[pluginName] = plugin;

            // create a config for any processors
            if (plugin.processors) {
                for (const processorName of Object.keys(plugin.processors)) {
                    if (processorName.startsWith(".")) {
                        debug(`Assigning processor: ${pluginName}/${processorName}`);

                        configs.unshift({
                            files: [`**/*${processorName}`],
                            processor: plugin.processors[processorName]
                        });
                    }

                }
            }

            // store environments
            if (plugin.environments) {
                const environmentNames = Object.keys(plugin.environments);

                environmentNames.forEach(environmentName => {
                    pluginEnvironments.set(
                        `${pluginName}/${environmentName}`,
                        plugin.environments[environmentName]
                    );
                });
            }
        }
    }

    // translate env - must come after plugins
    if (eslintrcConfig.env && typeof eslintrcConfig.env === "object") {
        for (const envName of Object.keys(eslintrcConfig.env)) {

            // only add environments that are true
            if (eslintrcConfig.env[envName]) {
                debug(`Translating environment: ${envName}`);

                if (environments.has(envName)) {

                    // built-in environments should be defined first
                    configs.unshift(...translateESLintRC(environments.get(envName), {
                        resolveConfigRelativeTo,
                        resolvePluginsRelativeTo
                    }));
                } else if (pluginEnvironments.has(envName)) {

                    // if the environment comes from a plugin, it should come after the plugin config
                    configs.push(...translateESLintRC(pluginEnvironments.get(envName), {
                        resolveConfigRelativeTo,
                        resolvePluginsRelativeTo
                    }));
                }
            }
        }
    }

    // only add if there are actually keys in the config
    if (Object.keys(dotConfig).length > 0) {
        configs.push(dotConfig);
    }

    return configs;
}


//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A compatibility class for working with configs.
 */
class DotCompat {

    constructor({
        baseDirectory = process.cwd(),
        resolvePluginsRelativeTo = baseDirectory
    } = {}) {
        this.baseDirectory = baseDirectory;
        this.resolvePluginsRelativeTo = resolvePluginsRelativeTo;
        this[cafactory] = new ConfigArrayFactory({
            cwd: baseDirectory,
            resolvePluginsRelativeTo,
            eslintAllPath: path.resolve(__dirname, "../conf/eslint-all.js"),
            eslintRecommendedPath: path.resolve(__dirname, "../conf/eslint-recommended.js")
        });
    }

    /**
     * Translates an ESLintRC-style config into a dot-config-style config.
     * @param {Object} eslintrcConfig The ESLintRC-style config object.
     * @returns {Object} A dot-config-style config object.
     */
    config(eslintrcConfig) {
        const eslintrcArray = this[cafactory].create(eslintrcConfig, {
            basePath: this.baseDirectory
        });

        const dotArray = [];

        eslintrcArray.forEach(configData => {
            if (configData.type === "config") {
                dotArray.push(...translateESLintRC(configData, {
                    resolveConfigRelativeTo: path.join(this.baseDirectory, "__placeholder.js"),
                    resolvePluginsRelativeTo: path.join(this.resolvePluginsRelativeTo, "__placeholder.js")
                }));
            }
        });

        return dotArray;
    }

    /**
     * Translates the `env` section of an ESLintRC-style config.
     * @param {Object} envConfig THe `env` section of an ESLintRC config.
     * @returns {Object} A dot-config object representing the environments.
     */
    env(envConfig) {
        return this.config({
            env: envConfig
        });
    }

    /**
     * Translates the `extends` section of an ESLintRC-style config.
     * @param {...string} configsToExtend The names of the configs to load.
     * @returns {Object} A dot-config object representing the config.
     */
    extends(...configsToExtend) {
        return this.config({
            extends: configsToExtend
        });
    }

    /**
     * Translates the `plugins` section of an ESLintRC-style config.
     * @param {...string} plugins The names of the plugins to load.
     * @returns {Object} A dot-config object representing the plugins.
     */
    plugins(...plugins) {
        return this.config({
            plugins
        });
    }
}

exports.DotCompat = DotCompat;