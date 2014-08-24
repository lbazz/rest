/*
 * Copyright 2012-2014 the original author or authors
 * @license MIT, see LICENSE.txt for details
 *
 * @author Scott Andrews
 */

(function (define) {
	'use strict';

	define(function (require) {

		var client, errorCode, mime, pathPrefix, when, pipeline, plugin;

		client = require('./client/default');
		errorCode = require('./interceptor/errorCode');
		mime = require('./interceptor/mime');
		pathPrefix = require('./interceptor/pathPrefix');
		when = require('when');
		pipeline = require('when/pipeline');


		function parseConfig(name, refObj) {
			if (console && refObj.entity) {
				(console.warn || console.log).call(console, 'rest.js: The entity interceptor is no longer included, please use response.entity() instead.');
			}

			return {
				prefix: name,
				mime: refObj.mime,
				accept: refObj.accept,
				errorCode: refObj.errorCode
			};
		}

		/**
		 * Builds the rest client for the provided config
		 *
		 * @param client the client to wrap
		 * @param config configuration for client interceptors
		 */
		function buildClient(client, config) {
			return when(client, function (client) {
				if (config.errorCode !== false) {
					client = errorCode(client, { code: config.errorCode });
				}
				if (config.mime !== false) {
					client = mime(client, { mime: config.mime || 'application/x-www-form-urlencoded', accept: config.accept });
				}
				client = pathPrefix(client, { prefix: config.prefix });
				return client;
			});
		}

		/**
		 * Resolves a 'rest' client for the specified path and scopes, e.g. client!url/to/resource
		 *
		 * @param resolver
		 * @param name
		 * @param refObj
		 * @param wire
		 */
		function resolveClient(resolver, name, refObj /*, wire */) {
			var config, client;

			config = parseConfig(name, refObj);
			client = buildClient(refObj.client, config);

			when(client, resolver.resolve, resolver.reject);
		}

		function normalizeRestFactoryConfig(spec, wire) {
			var config = {};

			config.parent = wire(spec.parent || client);
			config.interceptors = when.all((Array.isArray(spec) ? spec : spec.interceptors || []).map(function (interceptorDef) {
				var interceptorConfig = interceptorDef.config;
				delete interceptorDef.config;
				return wire(typeof interceptorDef === 'string' ? { module: interceptorDef } : interceptorDef).then(function (interceptor) {
					return { interceptor: interceptor, config: interceptorConfig };
				});
			}));

			return config;
		}

		/**
		 * Creates a rest client for the "rest" factory.
		 * @param resolver
		 * @param spec
		 * @param wire
		 */
		function restFactory(resolver, spec, wire) {
			var config = normalizeRestFactoryConfig(spec.rest || spec.options, wire);
			return config.parent.then(function (parent) {
				return config.interceptors.then(function (interceptorDefs) {
					pipeline(interceptorDefs.map(function (interceptorDef) {
						return function (parent) {
							return interceptorDef.interceptor(parent, interceptorDef.config);
						};
					}), parent).then(resolver.resolve, resolver.reject);
				});
			});
		}

		/**
		 * The plugin instance.  Can be the same for all wiring runs
		 */
		plugin = {
			resolvers: {
				client: resolveClient
			},
			factories: {
				rest: restFactory
			}
		};

		return {
			wire$plugin: function restPlugin(/* ready, destroyed, options */) {
				return plugin;
			}
		};

	});

}(
	typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }
	// Boilerplate for AMD and Node
));
