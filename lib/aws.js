var _          = require('underscore');
var exec       = require('child_process').exec;
var path       = require('path');
var fs         = require('fs');
var mime       = require('mime');
var AWS        = require('aws-sdk');
var dateFormat = require('dateformat');

module.exports = function(name, config) {
	/* Initialize AWS authentication settings
	--------------------------------------------------------- */
	AWS.config.region          = config.auth.region;
	AWS.config.accessKeyId     = config.auth.keyid;
	AWS.config.secretAccessKey = config.auth.secret;

	/* Initialize default config options
	--------------------------------------------------------- */
	if (config.acl == null)
		config.acl = 'public-read';

	if (config.cache != null) {
		var ts = (new Date()).getTime() + config.cache;
		config.Expires = dateFormat(new Date(ts), 'ddd, dd mmm yyyy HH:MM:ss Z');
		config.CacheControl = 'max-age='+config.cache;
	}

	if (!_.isNumber(config.threads) || config.threads < 1) {
		config.threads = 1;
	}

	/* Initialize properties
	--------------------------------------------------------- */
	this.sourcePath = path.join(config.target, name);

	var s3 = new AWS.S3();

	this.run = function(callback) {
		if (!fs.lstatSync(this.sourcePath).isDirectory())
			throw 'Source path does not exist: ' + this.sourcePath;

		this.processDir(name, this.sourcePath, callback);
	};

	this.processDir = function(folder, dir, callback) {
		var self = this;
		fs.readdir(dir, function(err, list) {
			if (err) throw err;

			function uploadFile(filename, filepath, list) {
				fs.readFile(filepath, function(err, data) {
					if (err) throw err;
					console.log('Uploading ' + filename);
					var obj = {
						'ACL'        : config.acl,
						'Body'       : data,
						'Bucket'     : config.s3.bucket + '/' + folder,
						'ContentType': mime.lookup(filename),
						'Key'        : filename
					};
					if (config.cache != null) {
						obj.Expires = config.Expires;
						obj.CacheControl = config.CacheControl;
					}
					s3.putObject(obj, function(err, res) {
						if (err != null) throw err;
						console.log(' -> OK / Tag: ' + res.ETag);
						walkList(list); // Next iteration
					});
				});
			}

			function walkList(list) {
				if (list.length === 0) {
					if (_.isFunction(callback)) callback();
					return;
				}

				var filename = list.shift();
				var filepath = path.join(dir, filename);

				if (fs.lstatSync(filepath).isDirectory())
					return;

				// Check if file exists
				if (!config.overwrite) {
					self.fileExists(filename, function(err, data) {
						if (err != null) {
							uploadFile(filename, filepath, list);
						} else {
							console.log('Skipping ' + filename);
							walkList(list);
						}
					});
				} else {
					uploadFile(filename, filepath, list);
				}
			}

			console.log('Uploading directory (' + config.threads + ' threads): ' + dir);

			var chunks = Math.ceil(list.length / config.threads);
			for (var i = 0 ; i < config.threads ; i++) {
				var s = list.slice(i * chunks , (i + 1) * chunks)
				walkList(s);
			}
		});
	};

	this.fileExists = function(filename, callback) {
		s3.headObject({
			'Bucket': config.s3.bucket + '/' + name,
			'Key': filename
		}, callback);
	};
}


