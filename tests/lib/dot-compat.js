/**
 * @fileoverview Tests for DotCompat class.
 * @author Nicholas C. Zakas
 */
"use strict";

//-----------------------------------------------------------------------------
// Requirements
//-----------------------------------------------------------------------------

const path = require("path");
const { assert } = require("chai");
const { DotCompat } = require("../../lib/");
const environments = require("../../conf/environments");

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const FIXTURES_BASE_PATH = path.resolve(__dirname, "../fixtures/dot-compat/");

/**
 * Normalizes a plugin object to have all available keys. This matches what
 * ConfigArrayFactory does.
 * @param {Object} plugin The plugin object to normalize.
 * @returns {Object} The normalized plugin object.
 */
function normalizePlugin(plugin) {
    return {
        configs: {},
        rules: {},
        environments: {},
        processors: {},
        ...plugin
    };
}

/**
 * Returns the full directory path for a fixture directory.
 * @param {string} dirName The directory name to resolve.
 * @returns {string} The full directory path to the fixture.
 */
function getFixturePath(dirName) {
    return path.join(FIXTURES_BASE_PATH, dirName);
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("DotCompat", () => {

    describe("config()", () => {

        let compat;
        const baseDirectory = getFixturePath("config");
        const pluginFixture1 = normalizePlugin(require(path.join(baseDirectory, "node_modules/eslint-plugin-fixture1")));
        const pluginFixture2 = normalizePlugin(require(path.join(baseDirectory, "node_modules/eslint-plugin-fixture2")));
        const pluginFixture3 = normalizePlugin(require(path.join(baseDirectory, "node_modules/eslint-plugin-fixture3")));

        beforeEach(() => {
            compat = new DotCompat({
                baseDirectory
            });
        });

        describe("top-level", () => {

            it("should translate ignorePatterns string into ignores array", () => {
                const result = compat.config({
                    ignorePatterns: "**/*.jsx"
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    ignores: ["**/*.jsx"]
                });
            });

            it("should translate ignorePatterns array into ignores array", () => {
                const result = compat.config({
                    ignorePatterns: ["**/*.jsx"]
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    ignores: ["**/*.jsx"]
                });
            });

            it("should translate settings", () => {
                const result = compat.config({
                    settings: {
                        foo: true,
                        bar: false
                    }
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    settings: {
                        foo: true,
                        bar: false
                    }
                });
            });

            it("should translate plugins without processors", () => {
                const result = compat.config({
                    plugins: ["fixture1"]
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    plugins: {
                        fixture1: pluginFixture1
                    }
                });
            });

            it("should translate plugins with processors", () => {
                const result = compat.config({
                    plugins: ["fixture2"]
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    files: ["**/*.md"],
                    processor: pluginFixture2.processors[".md"]
                });
                assert.deepStrictEqual(result[1], {
                    plugins: {
                        fixture2: pluginFixture2
                    }
                });
            });

            it("should translate multiple plugins", () => {
                const result = compat.config({
                    plugins: ["fixture1", "fixture2"]
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    files: ["**/*.md"],
                    processor: pluginFixture2.processors[".md"]
                });
                assert.deepStrictEqual(result[1], {
                    plugins: {
                        fixture1: pluginFixture1,
                        fixture2: pluginFixture2
                    }
                });
            });

            it("should translate plugins with environments", () => {
                const result = compat.config({
                    plugins: ["fixture3"],
                    env: {
                        "fixture3/a": true,
                        "fixture3/b": true
                    }
                });

                assert.strictEqual(result.length, 3);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        globals: {
                            foo: true
                        }
                    }
                });
                assert.deepStrictEqual(result[1], {
                    languageOptions: {
                        globals: {
                            bar: false
                        }
                    }
                });
                assert.deepStrictEqual(result[2], {
                    plugins: {
                        fixture3: pluginFixture3
                    }
                });
            });

        });

        describe("extends", () => {
            it("should translate extends string into a config object", () => {
                const result = compat.config({
                    extends: "fixture1",
                    rules: {
                        foo: "warn"
                    }
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        globals: {
                            foobar: true
                        }
                    }
                });
                assert.deepStrictEqual(result[1], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate extends eslint:all into a string", () => {
                const result = compat.config({
                    extends: "eslint:all",
                    rules: {
                        foo: "warn"
                    }
                });
                
                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], "eslint:all");
                assert.deepStrictEqual(result[1], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate extends [eslint:all] into a string", () => {
                const result = compat.config({
                    extends: ["eslint:all"],
                    rules: {
                        foo: "warn"
                    }
                });
                
                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], "eslint:all");
                assert.deepStrictEqual(result[1], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate extends eslint:recommended into a string", () => {
                const result = compat.config({
                    extends: "eslint:recommended",
                    rules: {
                        foo: "warn"
                    }
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], "eslint:recommended");
                assert.deepStrictEqual(result[1], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate extends [eslint:recommended] into a string", () => {
                const result = compat.config({
                    extends: ["eslint:recommended"],
                    rules: {
                        foo: "warn"
                    }
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], "eslint:recommended");
                assert.deepStrictEqual(result[1], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate extends array into a config object", () => {
                const result = compat.config({
                    extends: ["fixture1"],
                    rules: {
                        foo: "warn"
                    }
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        globals: {
                            foobar: true
                        }
                    }
                });
                assert.deepStrictEqual(result[1], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate extends array with multiple configs into config objects", () => {
                const result = compat.config({
                    extends: ["fixture1", "eslint:all", "fixture2"],
                    rules: {
                        foo: "warn"
                    }
                });

                assert.strictEqual(result.length, 4);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        globals: {
                            foobar: true
                        }
                    }
                });
                assert.deepStrictEqual(result[1], "eslint:all");
                assert.deepStrictEqual(result[2], {
                    languageOptions: {
                        globals: {
                            foobar: false
                        }
                    },
                    rules: {
                        foobar: "error"
                    }
                });
                assert.deepStrictEqual(result[3], {
                    rules: {
                        foo: "warn"
                    }
                });
            });

        });

        describe("overrides", () => {
            it("should translate files string into files array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: "**/*.jsx",
                            rules: {
                                foo: "warn"
                            }
                        }
                    ]
                });
                
                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*.jsx"],
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate files array into files array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: ["**/*.jsx"],
                            rules: {
                                foo: "warn"
                            }
                        }
                    ]
                });
                
                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*.jsx"],
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate files array with multiple patterns into files array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: ["**/*.jsx", "**/*.js"],
                            rules: {
                                foo: "warn"
                            }
                        }
                    ]
                });
                
                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*.jsx", "**/*.js"],
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate files/excludedFiles strings into files/ignores array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: "**/*",
                            excludedFiles: "**/*.jsx",
                            rules: {
                                foo: "warn"
                            }
                        }
                    ]
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*"],
                    ignores: ["**/*.jsx"],
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate files/excludedFiles arrays into files/ignores array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: ["**/*"],
                            excludedFiles: ["**/*.jsx"],
                            rules: {
                                foo: "warn"
                            }
                        }
                    ]
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*"],
                    ignores: ["**/*.jsx"],
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate files/excludedFiles arrays with multiple items into files/ignores array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: ["**/*.js", "**/*.jsx"],
                            excludedFiles: ["**/*.test.js", "**/*test.jsx"],
                            rules: {
                                foo: "warn"
                            }
                        }
                    ]
                });

                assert.strictEqual(result.length, 2);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*.js", "**/*.jsx"],
                    ignores: ["**/*.test.js", "**/*test.jsx"],
                    rules: {
                        foo: "warn"
                    }
                });
            });

            it("should translate multiple files/excludedFiles arrays with multiple items into files/ignores array", () => {
                const result = compat.config({
                    rules: {
                        foo: "error"
                    },
                    overrides: [
                        {
                            files: ["**/*.js", "**/*.jsx"],
                            excludedFiles: ["**/*.test.js", "**/*test.jsx"],
                            rules: {
                                foo: "warn"
                            }
                        },
                        {
                            files: ["**/*.md", "**/*.mdx"],
                            excludedFiles: ["**/*.test.md", "**/*test.mdx"],
                            rules: {
                                bar: "error"
                            }
                        }

                    ]
                });

                assert.strictEqual(result.length, 3);
                assert.deepStrictEqual(result[0], {
                    rules: {
                        foo: "error"
                    }
                });
                assert.deepStrictEqual(result[1], {
                    files: ["**/*.js", "**/*.jsx"],
                    ignores: ["**/*.test.js", "**/*test.jsx"],
                    rules: {
                        foo: "warn"
                    }
                });
                assert.deepStrictEqual(result[2], {
                    files: ["**/*.md", "**/*.mdx"],
                    ignores: ["**/*.test.md", "**/*test.mdx"],
                    rules: {
                        bar: "error"
                    }
                });
            });

        });

        describe("linterOptions", () => {

            ["noInlineConfig", "reportUnusedDisableDirectives"].forEach(propertyName => {
                it(`should translate ${propertyName} into linterOptions.${propertyName}`, () => {
                    const result = compat.config({
                        [propertyName]: true
                    });

                    assert.strictEqual(result.length, 1);
                    assert.deepStrictEqual(result[0], {
                        linterOptions: {
                            [propertyName]: true
                        }
                    });
                });
            });


            it("should translate multiple linteroptions", () => {
                const result = compat.config({
                    noInlineConfig: true,
                    reportUnusedDisableDirectives: false
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    linterOptions: {
                        noInlineConfig: true,
                        reportUnusedDisableDirectives: false
                    }
                });
            });

        });

        describe("languageOptions", () => {

            it("should translate globals", () => {
                const result = compat.config({
                    globals: {
                        foo: true,
                        bar: false
                    }
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        globals: {
                            foo: true,
                            bar: false
                        }
                    }
                });
            });

            it("should translate env into globals", () => {
                const result = compat.config({
                    env: {
                        amd: true
                    }
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        ...environments.get("amd")
                    }
                });
            });

            it("should translate parserOptions", () => {
                const result = compat.config({
                    parserOptions: {
                        foo: true,
                        bar: false
                    }
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        parserOptions: {
                            foo: true,
                            bar: false
                        }
                    }
                });
            });

            it("should translate parser string into an object", () => {
                const result = compat.config({
                    parser: "my-parser"
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        parser: require(getFixturePath("config/node_modules/my-parser"))
                    }
                });
            });

            it("should translate sourceType", () => {
                const result = compat.config({
                    parserOptions: {
                        sourceType: "module"
                    }
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        sourceType: "module"
                    }
                });
            });

            it("should translate multiple options", () => {
                const result = compat.config({
                    parserOptions: {
                        sourceType: "module"
                    },
                    globals: {
                        foo: true,
                        bar: false
                    }
                });

                assert.strictEqual(result.length, 1);
                assert.deepStrictEqual(result[0], {
                    languageOptions: {
                        sourceType: "module",
                        globals: {
                            foo: true,
                            bar: false
                        }
                    }
                });
            });

        });

    });

    describe("env()", () => {

        let compat;

        beforeEach(() => {
            compat = new DotCompat();
        });

        it("should translate env into globals", () => {
            const result = compat.env({
                amd: true
            });

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    ...environments.get("amd")
                }
            });
        });

        it("should not translate env into globals when env is false", () => {
            const result = compat.env({
                amd: true,
                node: false
            });

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    ...environments.get("amd")
                }
            });
        });

        it("should translate env with parserOptions.ecmaVersion into globals and languageOptions.ecmaVersion", () => {
            const result = compat.env({
                es6: true
            });

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    ecmaVersion: 6,
                    globals: {
                        ...environments.get("es6").globals
                    }
                }
            });
        });

        it("should translate env with parserOptions.ecmaFeatures.globalReturn into globals and languageOptions.parserOptions", () => {
            const result = compat.env({
                node: true
            });

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    parserOptions: environments.get("node").parserOptions,
                    globals: {
                        ...environments.get("node").globals
                    }
                }
            });
        });

        it("should translate env with parserOptions.ecmaFeatures.globalReturn into globals and languageOptions.parserOptions", () => {
            const result = compat.env({
                es2021: true
            });

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    ecmaVersion: 12,
                    globals: {
                        ...environments.get("es2021").globals
                    }
                }
            });
        });

    });

    describe("extends()", () => {

        let compat;

        beforeEach(() => {
            compat = new DotCompat({
                baseDirectory: getFixturePath("config")
            });
        });

        it("should translate extends string into a config object", () => {
            const result = compat.extends("fixture1");

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    globals: {
                        foobar: true
                    }
                }
            });
        });

        it("should translate extends eslint:all into a string", () => {
            const result = compat.extends("eslint:all");

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], "eslint:all");
        });

        it("should translate extends eslint:recommended into a string", () => {
            const result = compat.extends("eslint:recommended");

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], "eslint:recommended");
        });

        it("should translate extends array with multiple configs into config objects", () => {
            const result = compat.extends("fixture1", "eslint:all", "fixture2");
        
            assert.strictEqual(result.length, 3);
            assert.deepStrictEqual(result[0], {
                languageOptions: {
                    globals: {
                        foobar: true
                    }
                }
            });
            assert.deepStrictEqual(result[1], "eslint:all");
            assert.deepStrictEqual(result[2], {
                languageOptions: {
                    globals: {
                        foobar: false
                    },
                },
                rules: {
                    foobar: "error"
                }
            });
        });

    });


    describe("plugins()", () => {

        let compat;

        beforeEach(() => {
            compat = new DotCompat({
                baseDirectory: getFixturePath("config")
            });
        });

        it("should translate plugins without processors", () => {
            const result = compat.plugins("fixture1");

            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], {
                plugins: {
                    fixture1: {
                        configs: {},
                        rules: {},
                        environments: {},
                        processors: {},
                        ...require(path.join(compat.baseDirectory, "node_modules/eslint-plugin-fixture1"))
                    }
                }
            });
        });

        it("should translate plugins with processors", () => {
            const result = compat.plugins("fixture2");
            const plugin = require(path.join(compat.baseDirectory, "node_modules/eslint-plugin-fixture2"));

            assert.strictEqual(result.length, 2);
            assert.deepStrictEqual(result[0], {
                files: ["**/*.md"],
                processor: plugin.processors[".md"]
            });
            assert.deepStrictEqual(result[1], {
                plugins: {
                    fixture2: {
                        configs: {},
                        rules: {},
                        environments: {},
                        processors: {},
                        ...plugin
                    }
                }
            });
        });

        it("should translate multiple plugins", () => {
            const result = compat.plugins("fixture1", "fixture2");
            const plugin = require(path.join(compat.baseDirectory, "node_modules/eslint-plugin-fixture2"));

            assert.strictEqual(result.length, 2);
            assert.deepStrictEqual(result[0], {
                files: ["**/*.md"],
                processor: plugin.processors[".md"]
            });
            assert.deepStrictEqual(result[1], {
                plugins: {
                    fixture1: {
                        configs: {},
                        rules: {},
                        environments: {},
                        processors: {},
                        ...require(path.join(compat.baseDirectory, "node_modules/eslint-plugin-fixture1"))
                    },
                    fixture2: {
                        configs: {},
                        rules: {},
                        environments: {},
                        processors: {},
                        ...plugin
                    }
                }
            });
        });

    });

});