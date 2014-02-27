var _     = require('underscore');
var exec  = require('child_process').exec;
var path  = require('path');
var fs    = require('fs');
var mime  = require('mime');
var AWS   = require('aws-sdk');

module.exports = function(name, config) {
	/* Initialize AWS authentication settings
	--------------------------------------------------------- */
	AWS.config.region          = config.auth.region;
	AWS.config.accessKeyId     = config.auth.keyid;
	AWS.config.secretAccessKey = config.auth.secret;

	/* Initialize properties
	--------------------------------------------------------- */
	this.sourcePath = path.join(config.target, name);

	var s3         = new AWS.S3();

	this.run = function(callback) {
		if (!fs.lstatSync(this.sourcePath).isDirectory())
			throw 'Source path does not exist: ' + this.sourcePath;

		this.processDir(name, this.sourcePath, callback);
		return;

		s3.listBuckets(function(err, data) {
			for (var index in data.Buckets) {
				var bucket = data.Buckets[index];
				console.log("Bucket: ", bucket.Name, ' : ', bucket.CreationDate);
			}
		});
	}

	this.processDir = function(folder, dir, callback) {
		fs.readdir(dir, function(err, list) {
			if (err) throw err;

			function walkList(list) {
				if (list.length == 0) {
					if (_.isFunction(callback)) callback();
					return;
				}

				var filename = list.shift();
				var filepath = path.join(dir, filename);

				if (fs.lstatSync(filepath).isDirectory())
					return;

				fs.readFile(filepath, function(err, data) {
					if (err) throw err;
					console.log('Uploading ' + filename);
					s3.putObject({
						'ACL'        : 'public-read',
						'Body'       : data,
						'Bucket'     : config.s3.bucket + '/' + folder,
						'ContentType': mime.lookup(filename),
						'Key'        : filename
					}, function(err, res) {
						if (err != null) throw err;
						console.log(' -> OK / Tag: ' + res.ETag);
						walkList(list); // Next iteration
					});
				});
			}

			console.log('Uploading directory ' + dir);
			walkList(list);
		});
	}
}


