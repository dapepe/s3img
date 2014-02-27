s3img - An Amazon S3 Image Processing and Uploading Tool
========================================================

[![NPM](https://nodei.co/npm/s3img.png)](https://nodei.co/npm/s3img/)

Purpose
-------

`s3img` is a CLI tool based on Node.JS. Its original purpose is to convert and process images using ImageMagick and to
upload those images to Amazon S3. The intention behind this is to provide different image resultions (thumbnails, preview, fullscale, etc.)
for online shop systems.


Configuration
-------------

The configuration file includes various options.

```json
{
	"s3": {
		"keyid"    : "your-key-id",
		"secret"   : "your-key-secret",
		"bucket"   : "bucket name",
		"region"   : "your region"
	},
	"convertbin": "convert",
	"resizecmd": "%convertbin% %input% -trim -geometry %dimensions% -gravity center -background %bgcolor% -extent %dimensions% %output%",
	"sizes": {
		"thumb"    : [64, 50, "%convertbin% %input% -thumbnail %dimensions%^ -gravity center -extent %dimensions% %output%"],
		"preview"  : [165, 165],
		"full"     : [370, 370],
		"lightbox" : [1000, 1000]
	},
	"target": "./out",
	"source": "./src",
	"magick": [
		"command1 %output%"
	]
}
```

* The `s3` object containse the access information for Amazon S3.
* `convertbin` is the ImageMagick binary used for the convertion process
* `resizecmd` specifies the default resize command. The following replacement options exist:
	- `input`: The input file path
	- `output`: The output file path
	- `source`: The source directory
	- `target`: The target directory
	- `convertbin`: The convert command
	- `bgcolor`: The background fill color. If not specified, the color of the first pixel will be used.
	- `dimensions`: The dimensions
* `sizes` specifies an object consisting of the target with and height. An optional third parameter can be used to specify a custom `resizecmd`
* `source` points to the source directory
* `target` points to the target directory
* `magic` is an array consisting of addtional commands that will be executed after the convertion operation.
   You can use the same variables as in `resizecmd`


Usage
-----

```
s3img [OPTIONS]
```

CLI Options:

| Parameter |     Type    |                                    Description                                    |
| --------- | ----------- | --------------------------------------------------------------------------------- |
|           |             |                                                                                   |
| help      | boolean     | Show help                                                                         |
| config    | string      | Configuration file (Type "s3img --config --help" for more)                        |
| keyid     | string      | S3 key ID                                                                         |
| secret    | string      | S3 key secret                                                                     |
| bucket    | string      | S3 bucket ID                                                                      |
| region    | string      | S3 region (see http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region) |
| dir       | string      | The image directory                                                               |
| source    | string      | The source directory for the original images                                      |
| upload    | bool/string | Push images to S3                                                                 |
| convert   | bool/string | Convert images                                                                    |


### Convert images ###

Convert all images:

```
s3img -c ./config.json --convert
```

Convert a specific image set:

```
s3img -c ./config.json --convert=thumb
```


### Upload images ###

Upload all images:

```
s3img -c ./config.json --upload
```

Upload a specific image set:

```
s3img -c ./config.json --upload=thumb
```


Requirements
------------

Node.js with NPM (Tested with Node Version 0.10.22)

* [request](https://www.npmjs.org/package/request): ~2.27.0
* [nopt](https://www.npmjs.org/package/nopt): ~2.1.2
* [aws-sdk](https://www.npmjs.org/package/aws-sdk): ~2.0
* [mime](https://www.npmjs.org/package/mime): ~1.2
* [underscore](https://www.npmjs.org/package/underscore): ~1.6.0


License
-------
This work is licensed under the GNU Lesser General Public License (LGPL). You may also get a copy of the GNU Lesser General Public License from http://www.gnu.org/licenses/lgpl.txt.
