import 'babel-polyfill'

import fs from 'fs'
import path from 'path'
import glob from 'fast-glob'

import * as RelayCompiler from 'relay-compiler'
import * as GraphQL from 'graphql'

import { WatchmanClient } from 'relay-compiler/lib/GraphQLCompilerPublic'

import * as CoffeeParser from './parser'


buildWatchExpression = (options) -> [
	'allof',
	['type', 'f'],
	['anyof', (['suffix', ext] for ext in options.extensions)...],
	['anyof', (['match', include, 'wholename'] for include in options.include)...],
	(['not', ['match', exclude, 'wholename']] for exclude in options.exclude)...
]


getFilepathsFromGlob = (baseDir, {extensions, include, exclude}) ->
	patterns = ("#{inc}/*.+(#{extensions.join('|')})" for inc in include)

	glob.sync patterns,
		cwd: baseDir
		bashNative: []
		onlyFiles: true
		ignore: exclude


getRelayFileWriter = (baseDir) ->
	{
		codegenTransforms
		fragmentTransforms
		printTransforms
		queryTransforms
		schemaExtensions
	} = RelayCompiler.IRTransforms

	(onlyValidate, schema, documents, baseDocuments) ->
		new RelayCompiler.FileWriter {
			config: {
				baseDir
				compilerTransforms: {
					codegenTransforms
					fragmentTransforms
					printTransforms
					queryTransforms
				}
				customScalars: {}
				formatModule: RelayCompiler.formatGeneratedModule
				inputFieldWhiteListForFlow: []
				schemaExtensions
				useHaste: false
			}
			onlyValidate
			schema
			baseDocuments
			documents
		}


getSchema = (schemaPath) ->
	try
		source = fs.readFileSync(schemaPath, 'utf8')

		if path.extname(schemaPath) == '.json'
			source = GraphQL.printSchema GraphQL.buildClientSchema JSON.parse(source).data

		source = """
			directive @include(if: Boolean) on FRAGMENT | FIELD
			directive @skip(if: Boolean) on FRAGMENT | FIELD

			#{source}
			"""

		return GraphQL.buildASTSchema GraphQL.parse source
	catch error
		throw new Error """
			Error loading schema. Expected the schema to be a .graphql or a .json
			file, describing your GraphQL server's API. Error detail:

			#{error.stack}
			"""


# Ensure that a watchman "root" file exists in the given directory
# or a parent so that it can be watched

WATCHMAN_ROOT_FILES = ['.git', '.hg', '.watchmanconfig']

hasWatchmanRootFile = (testPath) ->
	while path.dirname(testPath) != testPath
		for file in WATCHMAN_ROOT_FILES
			if fs.existsSync(path.join(testPath, file))
				return true

		testPath = path.dirname(testPath)

	return false


export run = (options) ->
	schemaPath = path.resolve(process.cwd(), options.schema)

	unless fs.existsSync schemaPath
		throw new Error("--schema path does not exist: #{schemaPath}.")

	srcDir = path.resolve(process.cwd(), options.src)

	unless fs.existsSync srcDir
		throw new Error("--source path does not exist: #{srcDir}.")

	if options.watch
		unless options.watchman
			throw new Error('Watchman is required to watch for changes.')

		unless hasWatchmanRootFile(srcDir)
			throw new Error """
				--watch requires that the src directory have a valid watchman "root" file.

				Root files can include:
				- A .git/ Git folder
				- A .hg/ Mercurial folder
				- A .watchmanconfig file

				Ensure that one such file exists in #{srcDir} or its parents.
				"""

	reporter = new RelayCompiler.ConsoleReporter verbose: options.verbose

	useWatchman = options.watchman and await WatchmanClient.isAvailable()

	parserConfigs =
		default:
			baseDir: srcDir
			getFileFilter: CoffeeParser.getFileFilter
			getParser: CoffeeParser.getParser
			getSchema: () -> getSchema(schemaPath),
			watchmanExpression: if useWatchman then buildWatchExpression(options) else null
			filepaths: if useWatchman then null else getFilepathsFromGlob(srcDir, options)

	writerConfigs =
		default:
			getWriter: getRelayFileWriter(srcDir)
			isGeneratedFile: (filePath) ->
				filePath.endsWith('.js') and filePath.includes('__generated__')
			parser: 'default'

	codegenRunner = new RelayCompiler.Runner {
		reporter
		parserConfigs
		writerConfigs
		onlyValidate: options.validate
	}

	if not options.validate and not options.watch and options.watchman
		console.log('HINT: pass --watch to keep watching for changes.')

	result = if options.watch
		await codegenRunner.watchAll()
	else
		await codegenRunner.compileAll()

	process.exit(100) if result == 'ERROR'

	process.exit(101) if options.validate and result != 'NO_CHANGES'

	return result

