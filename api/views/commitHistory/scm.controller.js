const errors = require('throw.js');
import log from './../../../utils/logger';
import gammaConfig from './../../../core/config';
import _ from 'underscore';
import _lodash from 'lodash';
import request from 'request';
import promiseRequest from 'request-promise';
import { spawn } from 'child_process';
import fs from 'fs.extra';
import path from 'path';
import * as cf from './../../../utils/common-functions';
import { getRepositoryDetails } from './../../v1/repository/repository.controller';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
const GITHUB_USER_URL = 'https://api.github.com/search/users';

export async function commitUserAvatars(req, res, next) {
    var emails = req.body.emails;

    if(_.size(emails))
    {
        let promises = emails
            .map(element => promiseRequest({
                url: `${GITHUB_USER_URL}?q=${element}+in:email`,
                headers: {
                    'User-Agent': 'Gamma'
                } })
                .then(function(response){

                    var avatar = {};
                    if (typeof response != undefined)
                    {
                        var responseBody = JSON.parse(response);
                        var items = responseBody.items;

                        if (_.size(items) > 0) {
                            avatar[element] = items[0].avatar_url;
                        }
                    }
                    return avatar;
                }).catch(error => {
                    return {};
                })
            );
        return Promise.all(promises).then(function(data) {
            res.status(200).json(_.reject(data, _.isEmpty));
        });
    }
    else{
        res.status(200).json({});
    }
}

export async function getRecos(req, res, next) {
    var params = {
        'tenant_uid': req.session.tenant_uid,
        'subsystem_uid': req.params.repositoryUid
    };
    /* sourceDirPath : is the path where we will copy .git/.svn folder, newly checkout source code.
       All git/svn operations will be executed on this path.
       This is required as we don't want to change existing source folder (created by GWS) */
    var sourceDirPath = path.join(`${(cf.actualPath(gammaConfig.analysisDBDetails.data_src, params))}`,`..`,`..`,`redata`,`${req.params.repositoryUid}`);
    // get repoType and repoUrl of given repository. true to get password also
    getRepositoryDetails(req, next, true)
    .then(repositoryDetails=>{
        if ((repositoryDetails.repoType).toLowerCase() == 'svn') {
            req.params.commitId = req.query.revisionId;
            getRootUrl(req)
            .then(rootUrl => {
                repositoryDetails.rootUrl = _lodash.trim(rootUrl,'\n');
                getSuggestionList(req, repositoryDetails, '', '', req.query.filePath)
                    .then(recosData => {
                        var output = {};
                        output.recosData = recosData;
                        output.filePath = path.join(sourceDirPath, req.query.filePath);
                        res.status(200).json(output);
                    })
                    .catch(error => {
                        return next(error);
                    });
            })
            .catch(error => {
                return next(error);
            });
        }
        else {
            repositoryDetails.repoType = 'git';
            copyMetaFolder(req, (repositoryDetails.repoType).toLowerCase(), sourceDirPath)
            .then(copyMetaData=>{
                    log.debug(copyMetaData);
                    checkoutCode(req, repositoryDetails, sourceDirPath, copyMetaData.sourceMetaDirPath, true)
                    .then(() => {
                        getSuggestionList(req, repositoryDetails, sourceDirPath, copyMetaData.sourceMetaDirPath, req.query.filePath)
                        .then(recosData => {
                            var output = {};
                            output.recosData = recosData;
                            output.filePath = path.join(sourceDirPath, req.query.filePath);
                            res.status(200).json(output);
                        })
                        .catch(error => {
                            return next(error);
                        });
                    })
                    .catch(error => {
                        return next(error);
                    });
            })
            .catch(error => {
                return next(error);
            });
        }
    });
}

// copy .git/.svn i.e metadata folder to this created sourceDirPath (metadata folder required for running commands)
export function getRootUrl(req) {
    var params = {
        'tenant_uid': req.session.tenant_uid,
        'subsystem_uid': req.params.repositoryUid
    };
    let sourceDirPath = path.join(`${(cf.actualPath(gammaConfig.analysisDBDetails.data_src, params))}`, 'src');
    return new Promise((resolve, reject) => {
        log.debug("====================== GET ROOT URL CODE : ===========================");
        let command = `svn info --show-item=repos-root-url ${sourceDirPath}`;
        log.debug(command);
        var childProcess = spawn(command, [], {
            shell: true
        });

        var stdout = "";
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        var stderr = "";
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        childProcess.on('exit', (code) => {
            log.debug("==============PROCESS STATUS CODE=================" + code);
            log.debug("==============PROCESS OUTPUT=================" + stdout);
            log.debug("==============PROCESS ERROR=================" + stderr);
            if (code == 0) {
                resolve(stdout);
            } else {
                log.error(stderr);
                reject(stderr);
            }
        });
    });
}

// copy .git/.svn i.e metadata folder to this created sourceDirPath (metadata folder required for running commands)
function copyMetaFolder(req, repoType, sourceDirPath) {
    var params = {
        'tenant_uid': req.session.tenant_uid,
        'subsystem_uid': req.params.repositoryUid
    };
    var srcDir = '', destDir = '';
    if (repoType == 'git') {
        srcDir = path.join(`${(cf.actualPath(gammaConfig.analysisDBDetails.data_src, params))}`, `src`, `.git`);
        destDir = path.join(`${sourceDirPath}`, `.git`);
    }


    log.debug("Source Meta Path : " + srcDir);
    log.debug("Destination Meta Path : " + destDir);

    return new Promise((resolve, reject) => {
        log.debug("======================METADATA COPY===========================");
        if (!fs.existsSync(destDir)) {
            fs.mkdirpSync(destDir);

            fs.copyRecursive(srcDir, destDir, function (err) {
                if (err) {
                    log.debug('An error occured while copying the folder.')
                    log.error(err);
                    return reject(err);
                }
                log.debug('Copy completed!');
                resolve({
                    'sourceMetaDirPath': destDir
                });
            });
        } else {
            resolve({
                'sourceMetaDirPath': destDir
            });
        }
    })
}

// checkout source code based on given commitId/revision in sourceDirPath
function checkoutCode(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, recursive) {
    let repoType = (repositoryDetails.repoType).toLowerCase();

    return new Promise((resolve, reject) => {
        log.debug("====================== CHECKOUT CODE : ===========================");
        let fetchCommand = '', checkoutCommand = '';
        var commitId = req.params.commitId;
        if (!recursive) {
            if (repoType == 'git') {
                log.debug("======================GIT CHECKOUT WITH FETCH===========================");
                fetchCommand = `git --work-tree ${sourceDirPath} --git-dir ${sourceMetaDirPath} fetch && `;
            }
        }

        if (repoType == 'git') {
            checkoutCommand = `
                        ${fetchCommand}
                        git --work-tree ${sourceDirPath} --git-dir ${sourceMetaDirPath} clean -fd &&
                        git --work-tree ${sourceDirPath} --git-dir ${sourceMetaDirPath} reset --hard &&
                        git --work-tree ${sourceDirPath} --git-dir ${sourceMetaDirPath} checkout ${commitId}`;
        }
        log.debug(checkoutCommand);
        var childProcess = spawn(checkoutCommand, [], {
            shell: true
        });

        var stdout = "";
        childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        var stderr = "";
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        childProcess.on('exit', (code) => {
            log.debug("==============PROCESS STATUS CODE=================" + code);
            log.debug("==============PROCESS OUTPUT=================" + stdout);
            log.debug("==============PROCESS ERROR=================" + stderr);
            if (code == 0) {
                resolve(stdout);
            } else {
                log.error(stderr);
                if (recursive) {
                    resolve(checkoutCode(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, false));
                } else {
                    reject(stderr);
                }
            }
        });
    });
}

function getSuggestionList(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, filePath) {
    return new Promise((resolve, reject) => {
        getDiffText(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, filePath)
        .then(diffText => {
            getFileContent(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, filePath)
            .then(fileContent => {
                log.debug("=============RECEIVED FILE CONTENT============");
                // log.debug("=========================DIFF TEXT====================");
                // log.debug(diffText);
                // log.debug("=========================FILE PATH====================");
                // log.debug(filePath);
                // log.debug("=========================FILE CONTENT====================");
                // log.debug(fileContent);
                getPotentialBugs(req, diffText, filePath, fileContent)
                    .then(recosData => {
                        resolve(recosData);
                    })
                    .catch(error => {
                        log.info(error);
                        reject(error);
                    });
            })
            .catch(error => {
                log.info(error);
                reject(error);
            });
        })
        .catch(error => {
            log.error(error);
            reject(error);
        });
    });
}

function getDiffText(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, filePath) {
    let repoType = (repositoryDetails.repoType).toLowerCase();
    let authInfo = getAuthenticationInfo(repositoryDetails);

    return new Promise((resolve, reject) => {
        let commitId = req.params.commitId;
        let diffCommand = '';
        let reDiffContextLines = (typeof gammaConfig.re_diff_context_lines != 'undefined')?gammaConfig.re_diff_context_lines:3;
        if (repoType == 'git') {
            diffCommand = `git --git-dir ${sourceMetaDirPath} --work-tree ${sourceDirPath} show -p -1 --unified=${reDiffContextLines} --ignore-space-at-eol --ignore-space-change --ignore-blank-lines --ignore-all-space ${commitId} -- ${filePath}`;
        }
        else if (repoType == 'svn') {
            commitId = commitId;
            prevCommitId = parseInt(commitId) - 1;
            // diffCommand = `svn diff ${sourceDirPath}/${filePath} -r ${commitId} -x --unified -x --ignore-space-change -x --ignore-all-space -x --ignore-eol-style -x --show-c-function --git`;
            diffCommand = `svn diff ${authInfo} -x -U${reDiffContextLines} ${repositoryDetails.rootUrl}${sourceDirPath}/${filePath}@${commitId} ${repositoryDetails.rootUrl}${sourceDirPath}/${filePath}@${prevCommitId} --non-interactive --trust-server-cert-failures=unknown-ca`;
        }
        log.debug("======================Command: get diff to pass with API /recos_file_text===========================");
        log.debug(diffCommand);
        var childProcess = spawn(diffCommand, [], {
            shell: true
        });

        var stdout = null;
        childProcess.stdout.on('data', (data) => {
            if(stdout == null) {
                stdout = data;
            } else {
                stdout = Buffer.concat([stdout, data]);
            }
        });

        var stderr = "";
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            log.info("=========GET DIFF COMMAND ERROR===========");
            log.error(stderr);
            reject(stderr);
        });

        childProcess.on('close', (code) => {
            var result = decodeWithEncoding(stdout);
            resolve(result);
        });
    });
}

export function getFileContent(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, filePath) {
    log.debug("==========INSIDE getFileContent==========");
    let repoType = (repositoryDetails.repoType).toLowerCase();
    let authInfo = getAuthenticationInfo(repositoryDetails);

    return new Promise((resolve, reject) => {
        let commitId = req.params.commitId;
        let showFileCommand;

        if (repoType == 'git') {
            showFileCommand = `git --git-dir ${sourceMetaDirPath} --work-tree ${sourceDirPath} show :${filePath}`;
        } else if (repoType == 'svn') {
            showFileCommand = `svn cat ${authInfo} ${repositoryDetails.rootUrl}${filePath}@${commitId} --non-interactive --trust-server-cert-failures=unknown-ca`;
        }

        log.debug("======================Command: file content to pass with API /recos_file_text===========================");
        log.debug(showFileCommand);
        var childProcess = spawn(showFileCommand, [], {
            shell: true
        });
        log.debug("========getFileContent: childProcess=========");

        var stdout = null;
        childProcess.stdout.on('data', (data) => {
            if(stdout == null) {
                stdout = data;
            } else {
                stdout = Buffer.concat([stdout, data]);
            }
        });

        var stderr = "";
        childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            log.info("=========SHOW FILE COMMAND ERROR===========");
            log.error(stderr);
            reject(stderr);
        });

        childProcess.on('close', (code) => {
            var result = decodeWithEncoding(stdout);
            resolve(result);
        });
    });
}

export function getPotentialBugs(req, diffText, filePath, fileContent) {
    log.debug("==========INSIDE getPotentialBugs==========");
    return new Promise((resolve, reject) => {
        let recosAPIName = (typeof gammaConfig.cmod_recos_mode != 'undefined' && gammaConfig.cmod_recos_mode == "inference") ? "recos_file_inference_diff" : "recos_file_text";
        log.debug("==========CALLAING API "+recosAPIName+"============");
        log.debug(`${gammaConfig.re_host}/v1.0/${recosAPIName}`);
        let requestJson = {
            "diff_text": diffText,
            "file": filePath,
            "file_content": fileContent,
            "project_uid": req.params.repositoryUid
        };
        request({
            url: `${gammaConfig.re_host}/v1.0/${recosAPIName}`, //URL to hit
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false,
            json: requestJson
        }, function (error, response, body) {
            if (error)
                reject(error);
            else if (response.statusCode == 404) {
                var error = {
                    status: 'error',
                    message: body.title,
                    details: body.detail
                };
                reject(error);
            } else if (response.statusCode == 500) {
                var error = {
                    status: 'error',
                    message: body.title,
                    details: body.detail
                };
                reject(error);
            } else if (response.statusCode == 200) {
                resolve(body);
            }
        });
    });
}

function getAuthenticationInfo(repositoryDetails) {
    let repoUsername = repositoryDetails.username;
    let repoPassword = repositoryDetails.password;
    let authInfo = '';
    if (repoUsername != "") {
        authInfo = `--username ${repoUsername}`;
    }
    if (repoPassword != "") {
        authInfo = `${authInfo} --password ${repoPassword}`
    }
    return authInfo;
}
function decodeWithEncoding(data) {

    let charsetMatch = jschardet.detect(data);
    log.info(`Character encoding of file is : ${charsetMatch.encoding}`);
    let decodeStr = iconv.decode(data, charsetMatch.encoding);
    return decodeStr;
}