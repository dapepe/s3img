var _     = require('underscore');
var exec  = require('child_process').exec;
var path  = require('path');
var fs    = require('fs');

module.exports = function(name, config) {
	/* Check options
	--------------------------------------------------------- */
	if (config.sizes == null)
		throw 'No sizes specified in config file!';
	if (!_.isArray(config.sizes[name]))
		throw 'No target size specified for "' + name + '"';

	// Initialize the resize command
	if (config.convertbin == null)
		config.convertbin = 'convert';
	if (config.resizecmd == null)
		config.resizecmd = '%convertbin% %input% -trim -geometry %dimensions% -gravity center -background %bgcolor% -extent %dimensions% %output%';
	if (config.extension == null)
		config.extension = '.jpg';

	if (config.sizes[name].length == 3)
		config.resizecmd = config.sizes[name].pop();
	else if (config.sizes[name].length != 2)
		throw 'Invalid size definition';

	if (_.isArray(config.magick)) {
		this.magick = config.magick;
	} else if (_.isObject(config.magick)) {
		if (config.magick[size] == null)
			throw 'No imagemagick definition for size "' + size + '"';

		if (!_.isArray(config.magick[size]))
			throw 'Imagemagick definition must be an array!';

		this.magick = config.magick[size];
	} else {
		this.magick = [];
	}

	/*
	@todo Support convertion and upload in one step
	if (config.upload) {
		var AwsInterface = require(path.join(path.dirname(fs.realpathSync(__filename)), 'aws.js'));
	}
	*/

	/* Initialize properties
	--------------------------------------------------------- */
	this.dimensions = config.sizes[name].join('x');
	this.sourcePath = config.source;
	this.targetPath = path.join(config.target, name);
	this.magickOpts = [];

	/**
	 * Execute convertion
	 */
	this.run = function(callback) {
		if (!fs.lstatSync(this.sourcePath).isDirectory())
			throw 'Source path does not exist: ' + this.sourcePath;

		this.processDir(this.sourcePath, callback);
	}

	/**
	 * Get the color of the first pixel in the upper left corner
	 *
	 * @param  {stirng}   filepath
	 * @param  {Function} callback
	 */
	this.getBgColor = function(filepath, callback) {
		if (config.bgcolor != null) {
			callback(config.bgcolor);
			return;
		}
		var cmd = 'convert ' + filepath + ' -crop "1x1+1+1" txt:-';
		exec(cmd, function (error, stdout, stderr) {
			if (error) throw error;
			var m = stdout.match(/#[A-Z0-9]{6}/i);
			callback(m == null ? '#FFFFF' : m.shift());
		});
	}

	/**
	 * Initialize a command query
	 *
	 * @param  {stirng} cmd     Command string
	 * @param  {object} options Command options
	 * @return {string}         Command with inserts
	 */
	this.initCommand = function(cmd, options) {
		Object.keys(options).forEach(function(key) {
			cmd = cmd.replace(new RegExp('%'+key+'%', 'g'), options[key]);
		});
		return cmd;
	}

	/**
	 * Resize the image using ImageMagick CLI
	 *
	 * @param  {object}   options  Resize Options (input, output, bgcolor, dimensions)
	 * @param  {Function} callback
	 */
	this.resizeImg = function(options, callback) {
		exec(
			this.initCommand(config.resizecmd, options),
			callback
		);
	}

	/**
	 * Process a directory
	 *
	 * Read all included files and convert them into the desired format
	 *
	 * @param  {string}   dir      Directory path
	 */
	this.processDir = function(dir, callback) {
		fs.readdir(dir, function(err, list) {
			if (err) throw err;

			function walkList(list) {
				if (list.length == 0) {
					if (_.isFunction(callback)) callback();
					return;
				}

				var filename = list.shift();
				var filepath = path.join(dir, filename);

				if (fs.lstatSync(filepath).isDirectory()) {
					this.processDir(filepath, function() {
						walkList.call(this, list);
					}.bind(this));
				} else {
					if (path.extname(filename) != config.extension) {
						walkList.call(this, list);
						return;
					}
					if (config.overwrite) {
						this.processImage(filename, filepath, function() {
							console.log('Writing ' + filename);
							walkList.call(this, list);
						}.bind(this));
					} else {
						fs.exists(path.join(this.targetPath, filename), function(exists) {
							if (exists) {
								walkList.call(this, list);
								return;
							}

							this.processImage(filename, filepath, function() {
								console.log('Writing ' + filename);
								walkList.call(this, list);
							}.bind(this));
						}.bind(this));
					}
				}
			}

			console.log('Process directory ' + dir + ' (Target: ' + this.targetPath + ')');
			fs.exists(this.targetPath, function (exists) {
				if (!exists)
					fs.mkdirSync(this.targetPath);

				walkList.call(this, list);
			}.bind(this));

		}.bind(this));
	}

	/**
	 * Process a single image
	 *
	 * @param  {string}   filename Filename
	 * @param  {string}   filepath File path
	 * @param  {Function} callback
	 */
	this.processImage = function(filename, filepath, callback) {
		this.getBgColor(filepath, function(bgcolor) {
			var options = {
				'input'     : '"' + filepath + '"',
				'output'    : '"' + path.join(this.targetPath, filename) + '"',
				'source'    : '"' + this.sourcePath + '"',
				'target'    : '"' + this.targetPath + '"',
				'convertbin': config.convertbin,
				'bgcolor'   : bgcolor,
				'dimensions': this.dimensions
			};
			this.resizeImg(options, function(error, stdout, stderr) {
				// Execute additional magick options
				var len   = this.magick.length;

				if (len === 0) {
					if (_.isFunction(callback)) callback();
					return;
				}

				var count = 0;
				this.magick.forEach(function(cmd) {
					exec(
						this.initCommand(cmd, options),
						function() {
							count++;
							if (len == count)
								if (_.isFunction(callback)) callback();
						}
					);
				}.bind(this));
			}.bind(this));
		}.bind(this));
	}

	return this;
}
