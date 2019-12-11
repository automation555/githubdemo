const errors = require('throw.js');
import log from './../../../utils/logger';
import gammaConfig from './../../../core/config';
import request from 'request';
import _lodash from 'lodash';
import * as cf from './../../../utils/common-functions';
import path from 'path';
import moment from 'moment';
import {getFileContent, getRootUrl} from './scm.controller';
import { getRepositoryDetails } from './../../v1/repository/repository.controller';
var sqlQuery;

// Gets specified metric(:metric) value for all snapshots for a given repository
export async function getCommits(req, res, next) {
    let isLikelyBugs = (!_lodash.isUndefined(`${req.query.likely_bugs}`) && (`${req.query.likely_bugs}` === "true" || `${req.query.likely_bugs}` === true)) ? 1 : 0;
    let search = typeof req.query.search != 'undefined' ? `${req.query.search}` : '';
    let queryObject = {
        likely_bugs: isLikelyBugs,
        search: search
    }

    let startDate = req.query.start_date;
    let endDate = req.query.end_date;

    if (typeof startDate != 'undefined' && startDate != '' && typeof endDate != 'undefined' && endDate != '') {
        queryObject.start_date = moment(startDate + '00:00:01', 'DD-MM-YYYY HH:mm:ss').local().format();
        queryObject.end_date = moment(endDate + '23:59:59', 'DD-MM-YYYY HH:mm:ss').local().format();
    }
    request({
        url: `${gammaConfig.re_host}/v1.0/commits/${req.params.repositoryUid}/${req.query.offset}/${req.query.limit}`, //URL to hit
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        qs: queryObject,
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            return next(new errors.CustomError("InternalServerError", "Recommendation Engine is not running.", 500, 1034));
        }
        else if (response.statusCode == 404) {
            return next(new errors.CustomError("NotFound", JSON.parse(body).detail, 404, 1008));
        }
        else if (response.statusCode == 500) {
            return next(new errors.CustomError("InternalServerError", JSON.parse(body).detail, 500, 1018));
        } else if (response.statusCode == 200) {
            res.status(200).json(JSON.parse(body));
        }
    });
}

export async function showCommit(req, res, next) {
    request({
        url: `${gammaConfig.re_host}/v1.0/commit_details/${req.params.repositoryUid}/${req.params.commitId}`, //URL to hit
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            return next(new errors.CustomError("InternalServerError", "Something went wrong", 500, 1034));
        }
        else if (response.statusCode == 404) {
            return next(new errors.CustomError("NotFound", JSON.parse(body).detail, 404, 1008));
        }
        else if (response.statusCode == 500) {
            return next(new errors.CustomError("InternalServerError", JSON.parse(body).detail, 500, 1018));
        } else if (response.statusCode == 200) {
            if (body) {
                var commitDetails = JSON.parse(body);
                res.status(200).json(commitDetails);
            }
            else {
                res.status(200).json({});
            }
        }
    });
}

export async function getFile(req, res, next) {
    getRepositoryDetails(req, next, true)
    .then(repositoryDetails=>{
        var params = {
            'tenant_uid': req.session.tenant_uid,
            'subsystem_uid': req.params.repositoryUid
        };
        let sourceDirPath = path.join(`${(cf.actualPath(gammaConfig.analysisDBDetails.data_src, params))}`,`..`,`..`,`redata`,`${req.params.repositoryUid}`);
        let sourceMetaDirPath = path.join(`${sourceDirPath}`, `.git`);

        let repoType = (repositoryDetails.repoType).toLowerCase();
        if (repoType == 'svn')
        {
            getRootUrl(req)
            .then(rootUrl => {
                repositoryDetails.rootUrl = _lodash.trim(rootUrl,'\n');
                getFileContent(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, req.query.filePath)
                        .then(fileContent => {
                            res.status(200).json(fileContent);
                        });
            })
            .catch(error => {
                return next(error);
            });
        }
        else
        {
            repositoryDetails.repoType = 'git';
            getFileContent(req, repositoryDetails, sourceDirPath, sourceMetaDirPath, req.query.filePath)
                    .then(fileContent => {
                        res.status(200).json(fileContent);
                    });
        }
    })
    .catch(error => {
        return next(error);
    });
}