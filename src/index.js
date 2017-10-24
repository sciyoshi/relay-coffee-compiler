'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = undefined;

require('babel-polyfill');

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fastGlob = require('fast-glob');

var _fastGlob2 = _interopRequireDefault(_fastGlob);

var _relayCompiler = require('relay-compiler');

var RelayCompiler = _interopRequireWildcard(_relayCompiler);

var _graphql = require('graphql');

var GraphQL = _interopRequireWildcard(_graphql);

var _GraphQLCompilerPublic = require('relay-compiler/lib/GraphQLCompilerPublic');

var _parser = require('./parser');

var CoffeeParser = _interopRequireWildcard(_parser);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

// Generated by CoffeeScript 2.1.1
var WATCHMAN_ROOT_FILES, buildWatchExpression, getFilepathsFromGlob, getRelayFileWriter, _getSchema, hasWatchmanRootFile;

buildWatchExpression = function buildWatchExpression(options) {
  var exclude, ext, include;
  return ['allof', ['type', 'f'], ['anyof'].concat(_toConsumableArray(function () {
    var i, len, ref, results;
    ref = options.extensions;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      ext = ref[i];
      results.push(['suffix', ext]);
    }
    return results;
  }())), ['anyof'].concat(_toConsumableArray(function () {
    var i, len, ref, results;
    ref = options.include;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      include = ref[i];
      results.push(['match', include, 'wholename']);
    }
    return results;
  }()))].concat(_toConsumableArray(function () {
    var i, len, ref, results;
    ref = options.exclude;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      exclude = ref[i];
      results.push(['not', ['match', exclude, 'wholename']]);
    }
    return results;
  }()));
};

getFilepathsFromGlob = function getFilepathsFromGlob(baseDir, _ref) {
  var extensions = _ref.extensions,
      include = _ref.include,
      exclude = _ref.exclude;

  var inc, patterns;
  patterns = function () {
    var i, len, results;
    results = [];
    for (i = 0, len = include.length; i < len; i++) {
      inc = include[i];
      results.push(inc + '/*.+(' + extensions.join('|') + ')');
    }
    return results;
  }();
  return _fastGlob2.default.sync(patterns, {
    cwd: baseDir,
    bashNative: [],
    onlyFiles: true,
    ignore: exclude
  });
};

getRelayFileWriter = function getRelayFileWriter(baseDir) {
  var codegenTransforms, fragmentTransforms, printTransforms, queryTransforms, schemaExtensions;
  var _RelayCompiler$IRTran = RelayCompiler.IRTransforms;
  codegenTransforms = _RelayCompiler$IRTran.codegenTransforms;
  fragmentTransforms = _RelayCompiler$IRTran.fragmentTransforms;
  printTransforms = _RelayCompiler$IRTran.printTransforms;
  queryTransforms = _RelayCompiler$IRTran.queryTransforms;
  schemaExtensions = _RelayCompiler$IRTran.schemaExtensions;

  return function (onlyValidate, schema, documents, baseDocuments) {
    return new RelayCompiler.FileWriter({
      config: {
        baseDir: baseDir,
        compilerTransforms: { codegenTransforms: codegenTransforms, fragmentTransforms: fragmentTransforms, printTransforms: printTransforms, queryTransforms: queryTransforms },
        customScalars: {},
        formatModule: RelayCompiler.formatGeneratedModule,
        inputFieldWhiteListForFlow: [],
        schemaExtensions: schemaExtensions,
        useHaste: false
      },
      onlyValidate: onlyValidate,
      schema: schema,
      baseDocuments: baseDocuments,
      documents: documents
    });
  };
};

_getSchema = function getSchema(schemaPath) {
  var error, source;
  try {
    source = _fs2.default.readFileSync(schemaPath, 'utf8');
    if (_path2.default.extname(schemaPath) === '.json') {
      source = GraphQL.printSchema(GraphQL.buildClientSchema(JSON.parse(source).data));
    }
    source = 'directive @include(if: Boolean) on FRAGMENT | FIELD\ndirective @skip(if: Boolean) on FRAGMENT | FIELD\n\n' + source;
    return GraphQL.buildASTSchema(GraphQL.parse(source));
  } catch (error1) {
    error = error1;
    throw new Error('Error loading schema. Expected the schema to be a .graphql or a .json\nfile, describing your GraphQL server\'s API. Error detail:\n\n' + error.stack);
  }
};

// Ensure that a watchman "root" file exists in the given directory
// or a parent so that it can be watched
WATCHMAN_ROOT_FILES = ['.git', '.hg', '.watchmanconfig'];

hasWatchmanRootFile = function hasWatchmanRootFile(testPath) {
  var file, i, len;
  while (_path2.default.dirname(testPath) !== testPath) {
    for (i = 0, len = WATCHMAN_ROOT_FILES.length; i < len; i++) {
      file = WATCHMAN_ROOT_FILES[i];
      if (_fs2.default.existsSync(_path2.default.join(testPath, file))) {
        return true;
      }
    }
    testPath = _path2.default.dirname(testPath);
  }
  return false;
};

var run = exports.run = function () {
  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(options) {
    var codegenRunner, parserConfigs, reporter, result, schemaPath, srcDir, useWatchman, writerConfigs;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            schemaPath = _path2.default.resolve(process.cwd(), options.schema);

            if (_fs2.default.existsSync(schemaPath)) {
              _context.next = 3;
              break;
            }

            throw new Error('--schema path does not exist: ' + schemaPath + '.');

          case 3:
            srcDir = _path2.default.resolve(process.cwd(), options.src);

            if (_fs2.default.existsSync(srcDir)) {
              _context.next = 6;
              break;
            }

            throw new Error('--source path does not exist: ' + srcDir + '.');

          case 6:
            if (!options.watch) {
              _context.next = 11;
              break;
            }

            if (options.watchman) {
              _context.next = 9;
              break;
            }

            throw new Error('Watchman is required to watch for changes.');

          case 9:
            if (hasWatchmanRootFile(srcDir)) {
              _context.next = 11;
              break;
            }

            throw new Error('--watch requires that the src directory have a valid watchman "root" file.\n\nRoot files can include:\n- A .git/ Git folder\n- A .hg/ Mercurial folder\n- A .watchmanconfig file\n\nEnsure that one such file exists in ' + srcDir + ' or its parents.');

          case 11:
            reporter = new RelayCompiler.ConsoleReporter({
              verbose: options.verbose
            });
            _context.t0 = options.watchman;

            if (!_context.t0) {
              _context.next = 17;
              break;
            }

            _context.next = 16;
            return _GraphQLCompilerPublic.WatchmanClient.isAvailable();

          case 16:
            _context.t0 = _context.sent;

          case 17:
            useWatchman = _context.t0;

            parserConfigs = {
              default: {
                baseDir: srcDir,
                getFileFilter: CoffeeParser.getFileFilter,
                getParser: CoffeeParser.getParser,
                getSchema: function getSchema() {
                  return _getSchema(schemaPath);
                },
                watchmanExpression: useWatchman ? buildWatchExpression(options) : null,
                filepaths: useWatchman ? null : getFilepathsFromGlob(srcDir, options)
              }
            };
            writerConfigs = {
              default: {
                getWriter: getRelayFileWriter(srcDir),
                isGeneratedFile: function isGeneratedFile(filePath) {
                  return filePath.endsWith('.js') && filePath.includes('__generated__');
                },
                parser: 'default'
              }
            };
            codegenRunner = new RelayCompiler.Runner({
              reporter: reporter,
              parserConfigs: parserConfigs,
              writerConfigs: writerConfigs,
              onlyValidate: options.validate
            });
            if (!options.validate && !options.watch && options.watchman) {
              console.log('HINT: pass --watch to keep watching for changes.');
            }

            if (!options.watch) {
              _context.next = 28;
              break;
            }

            _context.next = 25;
            return codegenRunner.watchAll();

          case 25:
            _context.t1 = _context.sent;
            _context.next = 31;
            break;

          case 28:
            _context.next = 30;
            return codegenRunner.compileAll();

          case 30:
            _context.t1 = _context.sent;

          case 31:
            result = _context.t1;

            if (result === 'ERROR') {
              process.exit(100);
            }
            if (options.validate && result !== 'NO_CHANGES') {
              process.exit(101);
            }
            return _context.abrupt('return', result);

          case 35:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, this);
  }));

  return function run(_x) {
    return _ref2.apply(this, arguments);
  };
}();