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
const { normalizePackageName } = require("../lib/shared/naming");
const { resolve } = require("../lib/shared/relative-module-resolver");
const createDebug = require("debug");

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const debug = createDebug("eslintrc:dot-compat");


/**
 * Translates an ESLintRC property that can be an array or a string into an
 * array on a dot-config.
 * @param {options} options The options to work on.
 * @param {Object} options.eslintrcConfig The ESLintRC config to work on.
 * @param {Object} options.dotConfig The dot config to work on.
 * @param {string} options.fromProperty The property to read on the ESLintRC
 *      config;
 * @param {string} options.toProperty The property to write to on the dot config.
 * @returns {Object} The dot config.
 */
function translateStringOrStringArray({
    eslintrcConfig,
    dotConfig = {},
    fromProperty,
    toProperty = fromProperty
}) {

    debug(`Translating ${fromProperty} to ${toProperty}`);

    if (Array.isArray(eslintrcConfig[fromProperty])) {
        dotConfig[toProperty] = eslintrcConfig[fromProperty];
    } else {
        dotConfig[toProperty] = [eslintrcConfig[fromProperty]];
    }

    return dotConfig;
}

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
    const configs = [dotConfig];
    const languageOptions = {};
    const linterOptions = {};
    const keysToCopy = ["settings", "rules", "processor"];
    const languageOptionsKeysToCopy = ["globals", "parser", "parserOptions", "sourceType"];
    const linterOptionsKeysToCopy = ["noInlineConfig", "reportUnusedDisableDirectives"];
    const pluginEnvironments = new Map();

    // copy over simple translations
    for (const key of keysToCopy) {
        if (key in eslintrcConfig) {
            dotConfig[key] = eslintrcConfig[key];
        }
    }

    // copy over languageOptions
    for (const key of languageOptionsKeysToCopy) {
        if (key in eslintrcConfig) {
            dotConfig.languageOptions = languageOptions;

            if (languageOptions[key] && typeof languageOptions[key] === "object") {
                languageOptions[key] = {
                    ...eslintrcConfig[key]
                };
            } else {
                languageOptions[key] = eslintrcConfig[key];

                if (key === "parser") {
                    debug(`Resolving parser '${languageOptions[key]}' relative to ${resolveConfigRelativeTo}`);
                    languageOptions[key] = require(resolve(eslintrcConfig[key], resolveConfigRelativeTo));
                }
            }
        }
    }

    // copy over linterOptions
    for (const key of linterOptionsKeysToCopy) {
        if (key in eslintrcConfig) {
            dotConfig.linterOptions = linterOptions;
            linterOptions[key] = eslintrcConfig[key];
        }
    }

    // move ecmaVersion a level up
    if (languageOptions.parserOptions && "ecmaVersion" in languageOptions.parserOptions) {
        languageOptions.ecmaVersion = languageOptions.parserOptions.ecmaVersion;
        delete languageOptions.parserOptions.ecmaVersion;

        // check to see if we even need parserOptions anymore and remove it if not
        if (Object.keys(languageOptions.parserOptions).length === 0) {
            delete languageOptions.parserOptions;
        }
    }

    if (eslintrcConfig.ignorePatterns) {

        const ignorePatternsConfig = translateStringOrStringArray({
            eslintrcConfig,
            fromProperty: "ignorePatterns",
            toProperty: "ignores"
        });

        configs.unshift(ignorePatternsConfig);
    }

    if (eslintrcConfig.files) {
        translateStringOrStringArray({
            eslintrcConfig,
            dotConfig,
            fromProperty: "files"
        });
    }

    if (eslintrcConfig.excludedFiles) {

        /*
        * If there is no `files` key, then we actually need to translate
        * `excludedFiles` into negation patterns.
        */
        if (!eslintrcConfig.files) {
            translateStringOrStringArray({
                eslintrcConfig,
                dotConfig,
                fromProperty: "excludedFiles",
                toProperty: "files"
            });

            dotConfig.files = [dotConfig.files.map(pattern => `!${pattern}`)];
        } else {
            translateStringOrStringArray({
                eslintrcConfig,
                dotConfig,
                fromProperty: "excludedFiles",
                toProperty: "ignores"
            });
        }

    }

    // translate plugins
    if (eslintrcConfig.plugins) {
        debug(`Translating plugins: ${eslintrcConfig.plugins}`);

        dotConfig.plugins = {};

        for (const pluginName of eslintrcConfig.plugins) {

            debug(`Translating plugin: ${pluginName}`);
            debug(`Resolving plugin '${pluginName} relative to ${resolvePluginsRelativeTo}`);

            const plugin = require(
                resolve(
                    normalizePackageName(pluginName, "eslint-plugin"),
                    resolvePluginsRelativeTo
                )
            );

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
    if (eslintrcConfig.env) {
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
    }

    /**
     * Translates an ESLintRC-style config into a dot-config-style config.
     * @param {Object} eslintrcConfig The ESLintRC-style config object.
     * @returns {Object} A dot-config-style config object.
     */
    config(eslintrcConfig) {
        return translateESLintRC(eslintrcConfig, {
            resolveConfigRelativeTo: path.join(this.baseDirectory, "__placeholder.js"),
            resolvePluginsRelativeTo: path.join(this.resolvePluginsRelativeTo, "__placeholder.js")
        });
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