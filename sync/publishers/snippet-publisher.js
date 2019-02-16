const { basename, extname } = require('path');

module.exports = class SnippetPublisher {
    /**
     * Constructs SnippetSync module
     * @param {Map} container
     * @param {Object} logger
     */
    constructor(container, logger) {
        this.container = container;
        this.logger = logger;
        this.github = this.container.module('github');
        this.languageMaps = {
            Brainfuck: 'brainfuck',
            'C++': 'cpp',
            'C#': 'cs',
            Clojure: 'clojure',
            ClojureScript: 'clojure-repl',
            CMake: 'cmake',
            CoffeeScript: 'coffeescript',
            Crystal: 'crystal',
            CSS: 'css',
            D: 'd',
            Dart: 'dart',
            Pascal: 'delphi',
            Diff: 'diff',
            Django: 'django',
            Dockerfile: 'dockerfile',
            EBNF: 'ebnf',
            Elm: 'elm',
            Erlang: 'erlang-repl',
            Fortran: 'fortran',
            'F#': 'fsharp',
            Gherkin: 'gherkin',
            Go: 'go',
            Groovy: 'groovy',
            HAML: 'haml',
            Haskell: 'haskell',
            Haxe: 'haxe',
            HTTP: 'http',
            toml: 'ini',
            Java: 'java',
            JavaScript: 'javascript',
            JSON: 'json',
            Julia: 'julia',
            Kotlin: 'kotlin',
            LESS: 'less',
            LiveScript: 'livescript',
            Lua: 'lua',
            Markdown: 'markdown',
            Mathematica: 'mathematica',
            Nginx: 'nginx',
            NSIS: 'nsis',
            'Objective-C': 'objectivec',
            Ocaml: 'ocaml',
            Perl: 'perl',
            PHP: 'php',
            PowerShell: 'powershell',
            'Properties files': 'properties',
            ProtoBuf: 'protobuf',
            Python: 'python',
            Puppet: 'puppet',
            Q: 'q',
            R: 'r',
            Ruby: 'ruby',
            Rust: 'rust',
            SAS: 'sas',
            Scala: 'scala',
            Scheme: 'scheme',
            SCSS: 'scss',
            Shell: 'shell',
            Smalltalk: 'smalltalk',
            SML: 'sml',
            SQL: 'sql',
            Stylus: 'stylus',
            Swift: 'swift',
            Tcl: 'tcl',
            LaTex: 'tex',
            TypeScript: 'typescript',
            Twig: 'twig',
            'VB.NET': 'vbnet',
            VBScript: 'vbscript',
            Verilog: 'verilog',
            VHDL: 'vhdl',
            HTML: 'xml',
            XQuery: 'xquery',
            YAML: 'yaml',
            Elixir: 'elixir'
        };
    }

    /**
     * Build Snippet note markdown content from raw data
     * @param {string} raw
     * @returns {string}
     */
    buildNoteContent(raw) {
        const {
            title,
            description,
            snippets
        } = raw;
        let note = '';
        note += `# ${title || 'Untitled Snippet'}\n`;
        note += (!description || title === description) ? '' : `${description}\n`;
        snippets.forEach((snippet) => {
            const {
                name,
                mode,
                content
            } = snippet;
            const lang = this.languageMaps[mode];
            note += `### ${name}\n`;
            note += `\`\`\`${lang}\n`;
            note += content;
            note += '\n```\n';
        });
        return note;
    }

    /**
     * Publish a snippet note to Github
     * @param {Object} options
     * @param {string} options.file
     * @param {string} options.raw
     * @returns {Promise<object>}
     */
    async publish({ file, raw }) {
        const noteContent = this.buildNoteContent(raw);
        const destinationFile = `${basename(file).replace(extname(file), '')}.md`;

        return this.github.publishNote({
            content: noteContent,
            remotePath: destinationFile,
            title: raw.title
        });
    }
};
