import fs from 'fs'
import path from 'path'
import assert from 'assert'
import coffeescript from 'coffeescript'

import * as GraphQL from 'graphql'
import FindGraphQLTags from 'relay-compiler/lib/FindGraphQLTags'
import { ASTCache } from 'relay-compiler/lib/GraphQLCompilerPublic'


# Throws an error if parsing the file fails
parseFile = (baseDir, file) ->
	text = fs.readFileSync(path.join(baseDir, file.relPath), 'utf8')

	assert text.indexOf('graphql') >= 0,
		'RelayJSModuleParser: Files should be filtered before passed
		to the parser, got unfiltered file `#{file}`.'

	if path.extname(file.relPath) in ['.coffee', '.cjsx']
		text = coffeescript.compile(text)

	astDefinitions = []

	for {tag, template} in FindGraphQLTags.memoizedFind(text, baseDir, file)
		if tag != 'graphql'
			throw new Error('Invalid tag #{tag} in #{file.relPath}. Expected graphql\`\`.')

		ast = GraphQL.parse(new GraphQL.Source(template, file.relPath))

		assert ast.definitions.length,
			'RelayJSModuleParser: Expected GraphQL text to contain at least one definition
			(fragment, mutation, query, subscription), got `#{template}`.'

		astDefinitions.push(ast.definitions...)

	return
		kind: 'Document'
		definitions: astDefinitions


export getParser = (baseDir) ->
	new ASTCache {
		baseDir
		parse: parseFile
	}


export getFileFilter = (baseDir) -> (file) ->
	fs.readFileSync(path.join(baseDir, file.relPath), 'utf8').indexOf('graphql') >= 0
