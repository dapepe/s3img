(function() {
	try {
		// Load libraries
		var querystring = require('querystring');
		var path        = require('path');
		var fs          = require('fs');
		var nopt        = require('nopt');
		var _           = require('underscore');

		var apiurl  = 'http://localhost/lingulog/server/';
		var version = '0.2.0'; // The required API version
		var auth    = {};

		// Default CLI options and short hands
		var defaultOptions = [
			{
				'name'       : 'help',
				'type'       : 'boolean',
				'description': 'Show help'
			},
			{
				'name'       : 'config',
				'type'       : 'string',
				'description': 'Configuration file (Type "s3img -help -config" for more)'
			},
			{
				'name'       : 'keyid',
				'type'       : 'string',
				'description': 'S3 key ID'
			},
			{
				'name'       : 'secret',
				'type'       : 'string',
				'description': 'S3 key secret'
			},
			{
				'name'       : 'bucket',
				'type'       : 'string',
				'description': 'S3 bucket ID'
			},
			{
				'name'       : 'region',
				'type'       : 'string',
				'description': 'S3 region (see http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region)'
			},
			{
				'name'       : 'dir',
				'type'       : 'string',
				'description': 'The image directory'
			},
			{
				'name'       : 'source',
				'type'       : 'string',
				'description': 'The source directory for the original images'
			},
			{
				'name'       : 'upload',
				'type'       : 'bool|string',
				'description': 'Push images to S3'
			},
			{
				'name'       : 'convert',
				'type'       : 'bool|string',
				'description': 'Process an image target ("s3img --convert" for all sets, "--convert={SET}" for once set)'
			}
		];
		var shortHands = {
			'c': ['--config'],
			'h': ['--help'],
			'u': ['--upload'],
			'p': ['--convert']
		}

		// Get the API definition
		function initialize() {
			initOptions();
			console.log();
		}

		/**
		 * Initialize the CLI Options
		 *
		 * @return void
		 */
		function initOptions() {
			try {
				var dargs = getParamList(defaultOptions);
				var opts  = nopt(dargs, shortHands, process.argv, 2);

				task = opts.argv.remain.pop();
				api  = opts.argv.remain.pop();

				// Display CLI help
				if (opts.help) {
					showCliHelp();
					if (opts.config != null) {
						console.log('Sample configuration file:');
						console.log();
						console.log(fs.readFileSync(path.join(path.dirname(fs.realpathSync(__filename)), 'config-demo.json'), 'utf8'));
						console.log();
					}
					return;
				}

				// Start to initialize the config
				var config = {};
				if (opts.config) {
					if (!fs.existsSync(opts.config))
						throw 'Config file does not exist: ' + opts.config;

					config = JSON.parse(fs.readFileSync(opts.config));
				}

				// Execute the upload
				if (opts.upload) {
					runAwsS3(opts, config);
					return;
				}

				// Process the images
				if (opts.convert) {
					runImageMagick(opts, config);
					return;
				}

				showCliHelp();

			} catch (e) {
				console.log();
				console.log('Failed to initialize options - ' + e);
				console.log();
				showCliHelp();
			}
		}

		/**
		 * Upload the images
		 *
		 * @param  {object} opts   CLI Options
		 * @param  {object} config The configuration settings
		 */
		function runAwsS3(opts, config) {
			try {
				['keyid', 'secret', 'bucket', 'region'].forEach(function(key) {
					if (opts[key] != null)
						auth[key] = opts[key];
					else if (config.s3 != null && config.s3[key] != null)
						auth[key] = config.s3[key];
					else
						throw 'Auth attribute "' + key + '" not set!';
				});

				config.auth = auth;

				var AwsInterface = require(path.join(path.dirname(fs.realpathSync(__filename)), 'aws.js'));
				runSet(AwsInterface, opts.upload, opts, config);
			} catch (e) {
				console.log();
				console.log('Failed to upload images - ' + e);
				console.log();
			}
		}

		/**
		 * Process the images
		 *
		 * @param  {object} opts   CLI Options
		 * @param  {object} config The configuration settings
		 */
		function runImageMagick(opts, config) {
			try {
				var ImageProcessor = require(path.join(path.dirname(fs.realpathSync(__filename)), 'img.js'));
				runSet(ImageProcessor, opts.convert, opts, config);
			} catch (e) {
				console.log();
				console.log('Failed to process images - ' + e);
				console.log();
			}
		}

		/**
		 * Process the images
		 *
		 * @param  {class}       processor The processing class
		 * @param  {bool|string} sizeId     Name of the set
		 * @param  {object}      opts      CLI Options
		 * @param  {object}      config    The configuration settings
		 */
		function runSet(processor, sizeId, opts, config) {
			try {
				if (sizeId === true) {
					var list = Object.keys(config.sizes);

					function walkList(list) {
						if (list.length == 0)
							return;

						var key = list.shift();
						(new processor(key, config)).run(function() {
							walkList(list);
						});
					}
					walkList(list);
				} else if (config.sizes[sizeId] == null) {
					throw 'Size "' + sizeId + '" not defined';
				} else {
					(new processor(sizeId, config)).run();
				}
			} catch (e) {
				console.log();
				console.log('Failed to run set - ' + e);
				console.log();
			}
		}

		/**
		 * Initialize an option type
		 *
		 * @param  {mixed} t
		 * @return {mixed}
		 */
		function getParamType(t) {
			if (t == undefined)
				return String;

			if (typeof t != 'string')
				return t;

			switch (t.toLowerCase()) {
				case 'string':
					return String;
				case 'bool':
				case 'boolean':
					return Boolean;
				case 'int':
				case 'integer':
				case 'num':
				case 'numeric':
				case 'float':
					return Number;
				case 'object':
					return Object;
				case 'array':
					return Array;
				default:
					return null;
			}
		}

		/**
		 * Build the option list from the definition object
		 *
		 * @param {array}
		 * @return {object} Parameter list
		 */
		function getParamList(opts) {
			var r = {};
			opts.forEach(function(opt) {
				if (opt.name == null)
					return;

				var t = getParamType(opt['type']);
				if (t != null)
					r[opt.name] = t;
			});

			return r;
		}

		/**
		 * Displays a parameter list
		 *
		 * @param  {string} title
		 * @param  {array} params
		 */
		function listParams(title, params) {
			console.log();
			console.log(title+':');
			console.log();
			var len = 0;
			var lines = [];
			params.forEach(function(opt) {
				var l = opt.name + (opt.optional === false ? '*' : '') + ' {' + opt['type'] + '}: ';
				if (l.length > len)
					len = l.length;
				lines.push([l, opt.description]);
			});
			lines.forEach(function(line) {
				console.log('	' + line[0] + Array(len - line[0].length + 3).join(' ') + line[1]);
			});
		}

		/**
		 * Display the help dialog
		 *
		 * @return void
		 */
		function showCliHelp() {
			console.log('S3 CLI client (Version: ' + version + ')');
			console.log();
			console.log('USAGE:');
			console.log();
			console.log('	s3img [OPTIONS]');

			listParams('General parameters', defaultOptions);

			console.log();
		}


		initialize();

	} catch(e) {
		console.log('ERROR', e);
	}
}).call(this);
