var sqlQuery;
const errors = require('throw.js');
import * as cf from '../../../utils/common-functions';
import * as gammaConfig from './../../../core/config';
import log from './../../../utils/logger';
import request from 'request';
import fs from 'fs.extra';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

const GET_FILE_URL = `${gammaConfig.analysisDBDetails.analysisHost}rest/scm/getFileByRev`;

export async function getFile(req, res, next) {
    let filePath = req.query.path;

    // Replace '\' or '\\' with '/'
    if (filePath.indexOf('\\') > 0){
        filePath = cf.replace_slash(filePath);
    }
    //get absolute path
    filePath = cf.absolute_path("", filePath);

    if (filePath != '') {
        if(req.query.snapshotId != undefined){
            getUidData(req)
            .then(uidData => {
                return getRepoData(req,uidData)
                .then(repoData => {
                    var params = { 'tenant_uid': repoData[0].tenant_uid, 'subsystem_uid': repoData[0].subsystem_uid };
                    var localDirectoryPath = cf.actualPath(gammaConfig.analysisDBDetails.data_src, params);
                    var repoType;
                    if (repoData[0].repositorytype == null || repoData[0].repositorytype == undefined || (repoData[0].repositorytype).toLowerCase() == 'github'){
                        repoType = 'GIT';
                    }else if ((repoData[0].repositorytype).toLowerCase() == 'bitbucket'){
                        repoType = 'BIT';
                    }else{
                        repoType = (repoData[0].repositorytype).toUpperCase();
                    }
                    if (repoType.toLowerCase() == 'zip' || repoType.toLowerCase() == 'remote') {
                        var revFilePath = localDirectoryPath + '/revision/' + uidData[0].version + '/' + filePath;
                        fs.open(revFilePath, 'r', function (err, fd) {
                            if(err)
                            {
                                if (err.code === 'ENOENT') {
                                    getLocalFile(filePath, req, res, next);
                                }
                            }
                            else {
                                log.info(`${repoType} : READING FILE FROM REVISION FOLDER :=  ${revFilePath}`);
                                let fileData = fs.readFileSync(revFilePath);       
                                let decodedFileData = decodeFileEncoding(fileData);
                                fs.close(fd, (closeErr) => {
                                    if (closeErr){ 
                                        log.error("Error while closing the file");
                                        log.error(closeErr);
                                    };
                                    res.status(200).json(decodedFileData);
                                });
                            }
                        });
                    }
                    else {
                        getRemoteFile(req, uidData, repoData, repoType, localDirectoryPath, filePath)
                        .then((statusCode)=>{
                            // return file to UI from here using path returned by service
                            // this is the filePath where file is going to checkout
                            if (statusCode == 200) {
                                var revFilePath = localDirectoryPath + '/revision/' + fileDTO.revision + '/' + filePath;
                                log.info(`FILE FETCHED FROM SERVER! READING FILE FROM :=  ${revFilePath}`);
                                let fileData = fs.readFileSync(revFilePath);       
                                let decodedFileData = decodeFileEncoding(fileData);
                                res.status(200).json(decodedFileData);
                            } else {
                                log.info("COULD NOT GET FILE FROM REMOTE :== FETCHING FILE FROM LOCAL");
                                getLocalFile(filePath, req, res, next);
                            }
                        })
                        .catch(error=>{
                            return next(error);
                        });
                        log.info("FETCHING FILE FROM REMOTE");
                        var fileDTO = {
                            "timeStamp": uidData[0].timestamp,
                            "revision": uidData[0].version,
                            "fileURL": filePath,
                            "forceUpdate": false,
                            "repoDTO": {
                                "subsystemUID": repoData[0].subsystem_uid,
                                "userName": (repoData[0].username == null || repoData[0].username == undefined || repoData[0].username == '') ? '' : repoData[0].username,
                                "password": (repoData[0].password == null || repoData[0].password == undefined || repoData[0].password == '') ? '' : repoData[0].password,
                                "branchName": repoData[0].branchname,
                                "projectPath": "",
                                "repositoryURL": repoData[0].repositoryurl,
                                "repositoryType": repoType,
                                "authMode": repoData[0].authentication_mode,
                                "sshKey": (repoData[0].ssh_key == null || repoData[0].ssh_key == undefined || repoData[0].ssh_key == '') ? '' : repoData[0].ssh_key,
                                "passPhrase": (repoData[0].passphrase == null || repoData[0].passphrase == undefined || repoData[0].passphrase == '') ? '' : repoData[0].passphrase,
                                "localDirectoryPath": localDirectoryPath
                            }
                        };
                    }
                });
            })
            .catch(error=>{
                return next(error);
            })
        }else{
            getOriginalFilePath(req, res, next);
        }
    } else {
        return next(new errors.BadRequest('Please provide file path.', 1000));
    }
}


function getUidData(req) {
    sqlQuery = `select * from ((select subsystem_uid from subsystems where id=$1) a cross join (select * from snapshots where id=$2) b)`;
    return req.corona.query(sqlQuery, [req.query.repositoryId, req.query.snapshotId])
        .then(data => {
            return new Promise((resolve, reject) => {
                resolve(data);
            });
        });
}

function getRepoData(req, uidData) {
    sqlQuery = `select coalesce(master_repository_details.name,'') as account_name,y.master_repository_id,y.subsystem_uid,y.tenant_id,tenant.tenant_uid,y.subsystem_id,y.repositoryURL,y.subsystem_language_array,y.subsystem_name,y.branchName,y.userName,y.password,y.repositoryType,y.analysisConfigOptions,y.authentication_mode,y.ssh_key,y.passphrase
            from
            (
            select subsystems.master_repository_id,subsystems.subsystem_uid,subsystems.tenant_id,subsystems.subsystem_id, subsystems.subsystem_repository_url as repositoryURL, subsystems.subsystem_language_array, subsystems.subsystem_name, subsystems.subsystem_repository_branch_name as branchName, subsystems.subsystem_repository_user_name as userName, subsystems.subsystem_repository_password as password, master_repository_types.type_name as repositoryType,subsystems.analysis_config as analysisConfigOptions,subsystems.authentication_mode,subsystems.ssh_key,subsystems.passphrase
        from subsystems left join master_repository_types on  subsystems.subsystem_repository_type=master_repository_types.id where subsystems.subsystem_id = (select subsystem_id from subsystems where subsystem_uid = '${uidData[0].subsystem_uid}')
        ) as  y  left join master_repository_details on y.master_repository_id=master_repository_details.id,tenant where y.tenant_id = tenant.id`;

    return req.gamma.query(sqlQuery, [])
        .then(data => {
            return new Promise((resolve, reject) => {
                resolve(data);
            });
        });
}

// gets file from data_src folder which is the default checkout folder
function getLocalFile(filePath, req, res, next) {
    sqlQuery = `select subsystem_uid from subsystems where id=$1`;
    req.corona.query(sqlQuery, [req.query.repositoryId])
        .then(data => {
            var params = { 'tenant_uid': req.session.tenant_uid, 'subsystem_uid': data[0].subsystem_uid };
            var temp_path = cf.actualPath(gammaConfig.analysisDBDetails.data_src, params);
            filePath = temp_path + '/src/' + filePath;
            log.info("READING FILE FROM := " + filePath);
            fs.open(filePath, 'r', function (err, fd) {
                if(err) {
                    if (err.code === 'ENOENT') {
                        getFileFromDb(req, res, next);
                    }
                }
                else {
                    let fileData = fs.readFileSync(filePath);       
                    let decodedFileData = decodeFileEncoding(fileData);
                                        
                    fs.close(fd, (closeErr) => {
                        if (closeErr){ 
                            log.error("Error while closing the file");
                            log.error(closeErr);
                        };
                        res.status(200).json(decodedFileData);
                    });
                }
            });
        });
}

function getRemoteFile(req, uidData, repoData, repoType, localDirectoryPath, filePath) {
    log.info("FETCHING FILE FROM REMOTE");
    return new Promise((resolve, reject) => {
        let params = {
            'tenant_uid': req.session.tenant_uid,
            'subsystem_uid': req.params.repositoryUid
        };
        log.debug(`${GET_FILE_URL}`);
        let fileDTO = {
            "timeStamp": uidData[0].timestamp,
            "revision": uidData[0].version,
            "fileURL": filePath,
            "forceUpdate": false,
            "repoDTO": {
                "subsystemUID": repoData[0].subsystem_uid,
                "userName": (repoData[0].username == null || repoData[0].username == undefined || repoData[0].username == '') ? '' : repoData[0].username,
                "password": (repoData[0].password == null || repoData[0].password == undefined || repoData[0].password == '') ? '' : repoData[0].password,
                "branchName": repoData[0].branchname,
                "projectPath": "",
                "repositoryURL": repoData[0].repositoryurl,
                "repositoryType": repoType,
                "authMode": repoData[0].authentication_mode,
                "sshKey": (repoData[0].ssh_key == null || repoData[0].ssh_key == undefined || repoData[0].ssh_key == '') ? '' : repoData[0].ssh_key,
                "passPhrase": (repoData[0].passphrase == null || repoData[0].passphrase == undefined || repoData[0].passphrase == '') ? '' : repoData[0].passphrase,
                "localDirectoryPath": localDirectoryPath
            }
        };
        request({
            url: `${GET_FILE_URL}`,
            method: 'POST',
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false,
            //Lets post the following key/values as form
            json: fileDTO
        }, function (error, response, body) {
            if (error) {
                log.error(error);
                reject(new errors.ServiceUnavailable("Embold service unavailable", 1021));
            } else {
                if (response.statusCode == 200) {
                    resolve(200);
                } else if (response.statusCode == 504) {
                    return next(new errors.GatewayTimeout(null, 1022));
                } else {
                    resolve(500);
                }
            }
        });
    });
}

// This function is used as fallback.Means if file is not fetched from remote location and its not present in $GAMMA_DATA location. This function
// will try to fetch the file from the location that is set from UI by user.
function getFileFromDb(req, res, next) {
    var filePath = req.query.path;
    // Replace '\' or '\\' with '/'
    if (filePath.indexOf('\\') > 0){
        filePath = cf.replace_slash(filePath);
    }
    //get absolute path
    filePath = cf.absolute_path("", filePath);

    sqlQuery = `select content from snapshot_contents where snapshotid=$1 AND key='srcdir'`;
    req.corona.query(sqlQuery, [req.query.snapshotId])
        .then(data => {
            filePath = data[0].content.toString() + filePath;
            log.info("READING FILE FROM (DB):= " + filePath);
            fs.open(filePath, 'r', function (err, fd) {
                if(err) {
                    if (err.code === 'ENOENT') {
                        getOriginalFilePath(req, res, next);
                    }
                }
                else {
                    let fileData        = fs.readFileSync(filePath);       
                    let decodedFileData = decodeFileEncoding(fileData);
                    fs.close(fd, (closeErr) => {
                        if (closeErr){ 
                            log.error("Error while closing the file");
                            log.error(closeErr);
                        };
                        res.status(200).json(decodedFileData);
                    });
                }
            });
        });
}

function getOriginalFilePath(req, res, next) {
    var filePath = req.query.path;
    fs.open(filePath, 'r', function (err, fd) {
        log.error(err);
        if (err) {
            if (err.code === 'ENOENT') {
                // var error = new Error();
                // error.code = 'GAMMA_FILE_ERROR';
                // return next(error);
                return next(new errors.CustomError("FileNotFound", "Unable to find file you are looking for.", 400, 1850));
            }
        }
        else {
            let fileData        = fs.readFileSync(filePath);
            let decodedFileData = decodeFileEncoding(fileData);
            fs.close(fd, (closeErr) => {
                if (closeErr){ 
                    log.error("Error while closing the file");
                    log.error(closeErr);
                };
                res.status(200).json(decodedFileData);
            });
        }
    });
}

function decodeFileEncoding(fileData) {
    let charsetMatch = jschardet.detect(fileData);
    log.info(`Character encoding of file is : ${charsetMatch.encoding}`);
    let decodeStr         = iconv.decode(fileData, charsetMatch.encoding);
    return decodeStr.toString();
}
