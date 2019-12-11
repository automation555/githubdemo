const errors = require('throw.js');
import * as gamma from './../../../core/gamma';

import gammaConfig from './../../../core/config';
// import gamma from './../../../core/gamma';
import fs from 'fs';
import async from 'async';
import log from './../../../utils/logger';
import request from 'request';
import pug from 'pug';
import pdf from 'html-pdf';
import mime from 'mime';
import _ from 'underscore';
import moment from 'moment';
import * as localisation from './../../views/localisation/localisation.controller';
import os from 'os';
import pathMod from 'path';
import * as db from './../../../component/db';

var osPlatform = os.platform();
var language = localisation.language;
var translation = localisation.translation;

var component_level_antipattern_colors = { 'BC': '#e06270', 'GBR': '#e9d189', 'GBU': '#c1b88d', 'GH': '#feac86', 'GC': '#fccc82', 'LBR': '#94af7b', 'LBU': '#aed592', 'DCD': '#529560', 'RPB': '#ded297', 'TB': '#b3a872', 'HB': '#cba455', 'FIC': '#EE9F9F','FI': '#EE9F9F', 'FME': '#B7CEDF', 'SSP':'#BAB2DD', 'MF':'#79bad1', 'FC':'#edec82'};
var method_level_antipattern_colors = { 'BM': '#aa5766', 'DC': '#a6987d', 'FE': '#dcbca6', 'IC': '#d68e6e', 'SS': '#f7e380', 'CSS': '#7bab84','CSW': '#c9bb72', 'CSI': '#eb9244', 'TH': '#aeb1bd', 'DE': '#96CFEC', 'MC': '#8DD6A0', 'FO': '#E59A96','DCL': '#4C93BD', 'UM':'#78D4D0','GV':'#D8986C','CF':'#80cec4','CC':'#c69ac7','NF':'#80cec4','NC':'#c69ac7','DVD':'#F7E172','PA':'#f49fd3','MJS':'#F3AD7D'};
var metrics_list = ["NOS","DOIH","NOM","Complexity","RFC","CBO","LOC","LOC_Comments","NOA","NOPA","ATFD","LCOM","CR","MaxNesting","NOAV","FDP","LAA","NOP"];
var checked_params = ['violations', 'no_violations'];
var graphData, has_components, master_antipattern_list, legendData;
const API_PREFIX = '/api/' + gammaConfig.apiVersion;



export function getDataForPdf(req, next){
    return new Promise ((resolve, reject)=>{

    if((isNaN(req.query.snapshot_id))){
        reject(new errors.BadRequest(gamma.i18next.t('server.error_message.bad_request',{'parameterName':'snapshot_id','parameterType': 'integer'}), 1000));
    }
    else{
        db.gammaDbPool.query(`select * from token where id=$1`, [req.session.tokenId])
        .then(token => {
            var timeZone = req.query.time_zone;
            // Set the headers for the request
            var headers = {
                'Authorization': `Bearer ${token[0].token}`
            };
            var protocol = req.protocol;
            if (gammaConfig.gamma_ui_env == 'live') {
                protocol = 'https';
            }
            // Configure the request for repositoryOverview
            var repositoryOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/' + req.params.repositoryUid + '/overview/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'project_id': req.query.project_id,
                    'snapshot_id': req.query.snapshot_id,
                    'node_id': req.query.node_id,
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            //api/repositories/:repo_id/distribution/metricviolations
            // Configure the request for metrics
            var metricsOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/' + req.params.repositoryUid + '/distribution/metricviolations/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'project_id': req.query.project_id,
                    'snapshot_id': req.query.snapshot_id,
                    'node_id': req.query.node_id
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // api/repositories/:repo_id/dashboard
            // Configure the request for repositoryOverview
            var repositoryDashboardOptions = {
                url: protocol + "://" + req.get('host') +'/api/views/repositories/' + req.params.repositoryUid + '/dashboard/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'repository_id': req.query.project_id,
                    'snapshot_id': req.query.snapshot_id,
                    'node_id': req.query.node_id
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // api/v1/repositories/:repositoryUid/metadata
            // Configure the request for worst component list
            var changeListParametersOptions = {
                url: protocol + "://" + req.get('host') + API_PREFIX + '/repositories/' + req.params.repositoryUid + '/metadata',
                method: 'GET',
                headers: headers,
                qs: {
                    'project_id': req.query.project_id
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };
            // api/views/repositories/:repositoryUid/snapshots/:snapshotId/nodes/:nodeId/breadcrumb
            // Configure the request for breadcrumb
            var breadcrumbOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/' + req.params.repositoryUid + '/breadcrumb/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'repositoryId': req.query.project_id,
                    'snapshotId': req.query.snapshot_id,
                    'nodeId': req.query.node_id
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // api/repositories/:repo_id/distribution/designissues
            // Configure the request for getdesignissues Component level
            var designIssueComponentLevelOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/' + req.params.repositoryUid + '/distribution/designissues/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'project_id': req.query.project_id,
                    'node_id': req.query.node_id,
                    'snapshot_id': req.query.snapshot_id,
                    'antipattern_type': 'C'
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // api/repositories/:repo_id/distribution/designissues
            // Configure the request for getdesignissues method level
            var designIssueMethodtLevelOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/' + req.params.repositoryUid + '/distribution/designissues/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'project_id': req.query.project_id,
                    'snapshot_id': req.query.snapshot_id,
                    'node_id': req.query.node_id,
                    'antipattern_type': 'M'
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // api/repositories/:repo_id/distribution/codeissues
            // Configure the request for code issues
            var codeIssuesOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/' + req.params.repositoryUid + '/distribution/codeissues/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'project_id': req.query.project_id,
                    'snapshot_id': req.query.snapshot_id,
                    'node_id': req.query.node_id,
                    'plot_by': 'issue_name'
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // api/v1/repositories/:repositoryUid/snapshots
            // Configure the request for snapshots
            var snapshotOptions = {
                url: protocol + "://" + req.get('host') + API_PREFIX + '/repositories/' + req.params.repositoryUid + '/snapshots',
                method: 'GET',
                headers: headers,
                qs: {
                    'subsystemUid': req.params.repositoryUid
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            // /:repositoryUid/language
            // Configure the request for ActiveLanguage
            var activeLanguageOptions = {
                url: protocol + "://" + req.get('host') + '/api/views/repositories/'+ req.params.repositoryUid + '/language/pdf',
                method: 'GET',
                headers: headers,
                qs: {
                    'snapshotId': req.query.snapshot_id,
                },
                rejectUnhauthorized: false,
                strictSSL: false,
            };

            async.parallel({
                snapshots: function (callback) {
                    request(snapshotOptions, function (error, response, body) {
                        if(error){
                            log.error(error);
                            return callback(true, {});
                        }
                        callback(null, body);
                    });
                },
                activeLanguage: function (callback) {
                    request(activeLanguageOptions, function (error, response, body) {
                        if(error){
                            log.error(error);
                            return callback(true, {});
                        }
                        callback(null, body);
                    });
                },
            }, function (err, results) {

                //To check if the snapshot given from query exists
                var snapshotData = _.size(results.snapshots) ? JSON.parse(results.snapshots) : [];
                var selectedSnapshotIndex = snapshotData.findIndex(function (item, i) {
                    return item.id == req.query.snapshot_id;
                });
                var snapshot = snapshotData[selectedSnapshotIndex];
                if (typeof snapshot == 'undefined') {
                    reject(new errors.CustomError("NoContentToDisplay", "No content to display", 204, 1026));
                    return false;
                }

                // check partial language and hide design issues
                var languagesResult = _.size(results.activeLanguage) ? JSON.parse(results.activeLanguage) : [];
                var activeLanguage = _.map(languagesResult, function (i) {
                    return i.toLowerCase();
                });
                var isPartialLanguage = true;

                _.each(activeLanguage, (v, k) => {
                    var isPartial = _.contains(gammaConfig.partial_languages, v);
                    if (!isPartial){
                        isPartialLanguage = false;
                    }
                });

                // Start the request
                async.parallel({
                    repositoryOverview: function (callback) {
                        request(repositoryOptions, function (error, response, body) {
                            if(error){
                                log.error(error);
                                return callback(true, {});
                            }
                            callback(null, body);
                        });
                    },
                    metrics: function (callback) {
                        request(metricsOptions, function (error, response, body) {
                            if(error){
                                log.error(error);
                                return callback(true, {});
                            }
                            callback(null, body);
                        });
                    },
                    repositoryDashboard: function (callback) {
                        request(repositoryDashboardOptions, function (error, response, body) {
                            if(error){
                                log.error(error);
                                return callback(true, {});
                            }
                            callback(null, body);
                        });
                    },
                    worseComponentList: function (callback) {
                        request(changeListParametersOptions, function (error, response, body) {
                            if (!error && response.statusCode == 200) {
                                var changeListData = JSON.parse(body);

                                var type = JSON.stringify(_.pluck(((changeListData.type).filter(d => d.classification == 'COMPONENTS')), 'id'));

                                var parameterId = _.first(_.pluck(((changeListData.ratings).filter(d => d.name == 'overallRating')), 'id'));

                                var output = {};
                                // api/repositories/:repo_id/list/components
                                // Configure the request for worst component list
                                var worseComponentListOptions = {
                                    url: protocol + "://" + req.get('host') + '/api/views/repositories/'+ req.params.repositoryUid + '/list/components/pdf',
                                    method: 'GET',
                                    headers: headers,
                                    qs: {
                                        'project_id': req.query.project_id,
                                        'snapshot_id': req.query.snapshot_id,
                                        'node_id': req.query.node_id,
                                        'snapshot_id_old': 0,
                                        'start_index': 0,
                                        'count': 20,
                                        'sortTypes': '{ "types": ["value_asc", "value_desc"] }',
                                        'selected_sort_parameter': '{"parameter_id": ' + parameterId + ', "sort_type": "value_asc" }',
                                        'checked_parameters': '{"selected":"ratings","ratings":' + parameterId + ',"type":' + type + ',"status":[""],"ruletypeid":"","ruletypename":"","metricid":"","hotspottype":[""],"codeissuetype":"","codeissuename":"","showAllComponents":false,"showImmediateComponents":false,"showDuplicateComponents":false}'
                                    },
                                    rejectUnhauthorized: false,
                                    strictSSL: false,
                                };

                                request(worseComponentListOptions, function (error, response, body) {
                                    if (!error && response.statusCode == 200) {
                                        output.worstComponents = body;

                                        // api/repositories/:repo_id/list/components
                                        // Configure the request for risk component list
                                        var riskComponentListOptions = {
                                            url: protocol + "://" + req.get('host') + '/api/views/repositories/'+ req.params.repositoryUid + '/list/components/pdf',
                                            method: 'GET',
                                            headers: headers,
                                            qs: {
                                                'project_id': req.query.project_id,
                                                'snapshot_id': req.query.snapshot_id,
                                                'node_id': req.query.node_id,
                                                'snapshot_id_old': 0,
                                                'start_index': 0,
                                                'count': 10,
                                                'sortTypes': '{ "types": ["value_asc", "value_desc"] }',
                                                'selected_sort_parameter': '{"parameter_id": 0, "sort_type": "value_desc" }',
                                                'checked_parameters': '{"selected":"ratings","ratings":0,"type":' + type + ',"status":[""],"ruletypeid":"","ruletypename":"","metricid":"","hotspottype":[""],"codeissuetype":"","codeissuename":"","showAllComponents":false,"showImmediateComponents":false,"showDuplicateComponents":false}'
                                            },
                                            rejectUnhauthorized: false,
                                            strictSSL: false,
                                        };

                                        request(riskComponentListOptions, function (error, response, body) {
                                            if(error){
                                                log.error(error);
                                                return callback(true, {});
                                            }
                                            output.riskComponents = body;
                                            callback(null, output);
                                        });

                                    } else {
                                        log.error(error);
                                        callback(true, {});
                                    }
                                });
                            } else {
                                log.error(error);
                                callback(true, {});
                            }
                        });
                    },
                    kpi: function (callback) {
                        request(breadcrumbOptions, function (error, response, body) {

                            if (!error && response.statusCode == 200) {
                                var breadcrumbData = JSON.parse(body);
                                var nodes = _.pluck(_.reject(breadcrumbData, d => d.parentid != req.query.node_id, "id"), "id");

                                // Configure the request for KPI
                                // api/repositories/:repo_id/dashboard/kpi/details
                                var kpiOptions = {
                                    url: protocol + "://" + req.get('host') + '/api/views/repositories/'+ req.params.repositoryUid + '/dashboard/kpi/details/pdf',
                                    method: 'GET',
                                    headers: headers,
                                    qs: {
                                        'subsystem': req.query.project_id,
                                        'snapshot_id': req.query.snapshot_id,
                                        'node_id': req.query.node_id,
                                        'time' : new Date().getTime()
                                    },
                                    rejectUnhauthorized: false,
                                    strictSSL: false,
                                };
                                request(kpiOptions, function (error, response, body) {

                                    if (!error && response.statusCode == 200) {
                                        var kpiData = (JSON.parse(body)).kpi_list;
                                        var kpiSum = {};
                                        _.each(kpiData, function (v, k) {
                                            _.each(v, function (v1, k1) {
                                                if (kpiSum[k1]) {
                                                    kpiSum[k1] = kpiSum[k1] + v1;
                                                } else {
                                                    kpiSum[k1] = v1;
                                                }
                                            });
                                        });
                                        callback(null, kpiSum);
                                    } else {
                                        log.error(error);
                                        callback(true, {});
                                    }
                                });
                            } else {
                                log.error(error);
                                callback(true, {});
                            }
                        });
                    },
                    designIssueComponentLevel: function (callback) {
                        if (!isPartialLanguage) {
                            request(designIssueComponentLevelOptions, function (error, response, body) {
                                if(error){
                                    log.error(error);
                                    return callback(true, {});
                                }
                                callback(null, body);
                            });
                        } else {
                            callback(null, {});
                        }
                    },
                    designIssueMethodtLevel: function (callback) {
                        if (!isPartialLanguage) {
                            request(designIssueMethodtLevelOptions, function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    callback(null, body);
                                } else {
                                    log.error(error);
                                    callback(true, {});
                                }
                            });
                        } else {
                            callback(null, {});
                        }
                    },
                    codeIssues: function (callback) {
                        request(codeIssuesOptions, function (error, response, body) {
                            if(error){
                                log.error(error);
                                return callback(true, {});
                            }
                            callback(null, body);
                        });
                    },
                    riskData: function (callback) {
                        var sql_query = `select * from get_comp_cnt_rating_vs_risk($1,$2)`;
                        req.corona.query(sql_query, [req.query.node_id, req.query.snapshot_id])
                            .then(data => {
                                var risk = {};
                                _.each(data, function (v, k) {
                                    risk[v.combination] = {
                                        'count': parseInt(v.comp_cnt)
                                    };
                                });
                                callback(null, risk);
                            });
                    },
                    snapshots: function (callback) {
                        var output = {};
                        var oldSnapShot, oldSnapshotID;
                        var snapshotNumbers = _.size(snapshotData);
                        if (snapshot && snapshotNumbers > 1) {
                            if ((selectedSnapshotIndex < snapshotNumbers) && selectedSnapshotIndex >0) {
                                if (!req.query.snapshot_id_old) {
                                    oldSnapShot = snapshotData[selectedSnapshotIndex - 1];
                                    oldSnapshotID = oldSnapShot.id;
                                } else {
                                    oldSnapshotID = req.query.snapshot_id_old;
                                    var oldSnapShotIndex = snapshotData.findIndex(function (item, i) {
                                        return item.id == req.query.snapshot_id_old;
                                    });
                                    oldSnapShot = snapshotData[oldSnapShotIndex];
                                }
                                // api/repositories/:repo_id/overview/changes/components
                                // Configure the request for chnage component list
                                var changeComponentOptions = {
                                    url: protocol + "://" + req.get('host') + '/api/views/repositories/'+ req.params.repositoryUid + '/overview/changes/components/pdf',
                                    method: 'GET',
                                    headers: headers,
                                    qs: {
                                        'project_id': req.query.project_id,
                                        'snapshot_id_new': req.query.snapshot_id,
                                        'snapshot_id_old': oldSnapshotID
                                    },
                                    rejectUnhauthorized: false,
                                    strictSSL: false,
                                };

                                request(changeComponentOptions, function (error, response, body) {
                                    if (!error && response.statusCode == 200) {
                                        output = JSON.parse(body);
                                        output.snapshot_time = getFormattedDate(snapshot.revtimestamp, timeZone);
                                        output.old_snapshot_time = getFormattedDate(oldSnapShot.revtimestamp, timeZone);
                                        callback(null, output);
                                    } else {
                                        log.error(error);
                                        callback(true, {});
                                    }
                                });
                            } else {
                                callback(null, output);
                            }
                        } else {
                            callback(null, output);
                        }
                    },
                }, function (err, results) {

                    if (err) {
                        err.code = 'GAMMA_DB_ERROR';
                        return next(err);
                    }
                    // report coe starts here
                    // log.debug(JSON.stringify(results));
                    var data = {};

                    var projectOverview = JSON.parse(results.repositoryOverview);

                    var designIssueComponentLevelData = _.size(results.designIssueComponentLevel) ? JSON.parse(results.designIssueComponentLevel) : false;
                    var checkComponentLevelData, designIssueComponentLevel, designIssueComponentLevelLegendData;

                    if (designIssueComponentLevelData) {
                        designIssueComponentLevel = createGraphData(designIssueComponentLevelData, 'component_level_antipatterns');

                        data.issueDistributionData = designIssueComponentLevel.d3Data;
                        data.issueDistributionColorsData = designIssueComponentLevel.colorsData;

                        checkComponentLevelData = _.filter(data.issueDistributionData, function (obj) {
                            return obj.data.length > 0;
                        });


                        designIssueComponentLevelLegendData = createLegendData(designIssueComponentLevelData, 'component_level_antipatterns');
                        data.issueDistributionLegend_legend_array = designIssueComponentLevelLegendData.legend_array;
                        data.issueDistributionLegend_color_array = designIssueComponentLevelLegendData.color_array;
                        data.issueDistributionLegend_data_array = designIssueComponentLevelLegendData.data_array;
                    }

                    var designIssueMethodtLevelData = _.size(results.designIssueMethodtLevel) ? JSON.parse(results.designIssueMethodtLevel) : false;
                    var designIssueMethodtLevel, designIssueMethodtLevelLegendData, checkMethodLevelData;

                    if (designIssueMethodtLevelData) {
                        designIssueMethodtLevel = createGraphData(designIssueMethodtLevelData, 'method_level_antipatterns');

                        data.issueDistributionMethodLevelData = designIssueMethodtLevel.d3Data;
                        data.issueDistributionMethodLevelColorsData = designIssueMethodtLevel.colorsData;

                        designIssueMethodtLevelLegendData = createLegendData(designIssueMethodtLevelData, 'method_level_antipatterns');
                        data.designIssueMethodtLevelLegend_legend_array = designIssueMethodtLevelLegendData.legend_array;
                        data.designIssueMethodtLevelLegend_color_array = designIssueMethodtLevelLegendData.color_array;
                        data.designIssueMethodtLevelLegend_data_array = designIssueMethodtLevelLegendData.data_array;

                        checkMethodLevelData = _.filter(data.issueDistributionMethodLevelData, function (obj) {
                            return obj.data.length > 0;
                        });
                    }

                    var categories = projectOverview.categories;

                    for (var item in categories) {
                        _.each(categories[item], (v, k) => {
                            if (k == 'type') {
                                categories[item][k] = translation[language][v];
                            }
                        });
                    }

                    var metricData = JSON.parse(results.metrics);

                    var metricViolationData = prepareMetricData(metricData);

                    _.map(metricViolationData[0].data, function (metric) {
                        metric.module = translation[language]['title.' + metric.module];
                    });

                    projectOverview.categories = categories;
                    projectOverview.repository_name = projectOverview.health_trend[0].subsystemname;
                    projectOverview.branch_name = "";

                    projectOverview.project_details.snapshot.ts = getFormattedDate(projectOverview.project_details.snapshot.ts, timeZone);
                    var healthTrendData = projectOverview.health_trend;
                    var trenData = [];
                    var trenLabel = [];

                    projectOverview.trend = (healthTrendData.length > 1) ? true : false;
                    projectOverview.design_issues_component_show = (_.size(categories[0].component_issue_details) > 0) ? true : false;
                    projectOverview.design_issues_subcomponent_show = (_.size(categories[0].subcomponent_issue_details) > 0) ? true : false;
                    projectOverview.metrics_show = (_.size(metricViolationData[0].data) > 0) ? true : false;
                    projectOverview.duplication_show = (_.size(categories[2].duplication_details) > 0) ? true : false;
                    projectOverview.code_issues_show = (_.size(categories[3].code_issue_details) > 0) ? true : false;
                    projectOverview.component_level_graph_show = (_.size(checkComponentLevelData) > 0) ? true : false;
                    projectOverview.method_level_graph_show = (_.size(checkMethodLevelData) > 0) ? true : false;
                    data.projectOverview = projectOverview;

                    // prepare trend graph data
                    for (var item in healthTrendData) {
                        var obj = {};
                        _.each(healthTrendData[item], (v, k) => {
                            if (k == 'ts') {
                                trenLabel.push(getFormattedDate(v, timeZone));
                            }

                            if (k == 'rating') {
                                var rating = roundNumber(v - 5);
                                trenData.push(rating);
                            }
                        });
                    }

                    data.trendGraphData = trenData;
                    data.trendGraphLabel = trenLabel;

                    var repositoryDashboardData = JSON.parse(results.repositoryDashboard);

                    var worseComponentList = JSON.parse(results.worseComponentList.worstComponents);
                    var riskComponentList = JSON.parse(results.worseComponentList.riskComponents);
                    riskComponentList.components = _.filter(riskComponentList.components, function (component) {
                        return component.risk != 'NA';
                    });

                    var riskData = results.riskData;
                    /*var riskData = {
                        'hl' : { 'count': 200 },
                        'hh': { 'count': 10 },
                        'll': { 'count': 80 },
                        'lh': { 'count': 520 },
                    }*/

                    var version = gammaConfig.version;

                    var reportDownloadDate = getFormattedDate(new Date().getTime(), timeZone);

                    var minRadius = 2;
                    var maxRadius = 10;

                    var maxRiskValue = _.max(_.pluck(riskData, 'count'));
                    var hasRiskData = (maxRiskValue > 0 ? true : false);

                    _.each(riskData, (v, k) => {
                        riskData[k]['radius'] = _.max([((v.count * maxRadius) / maxRiskValue), minRadius]);;
                    });

                    var codeIssuesData = prepareIssueData(JSON.parse(results.codeIssues));

                    projectOverview.code_issues_show = false;
                    var findResusslt = _.max(codeIssuesData.legendData, function (stooge) {
                        if (stooge > 0) {
                            projectOverview.code_issues_show = true;
                        }
                    })

                    var hasKpiData = _.size(results.kpi);

                    var changeOverviewData = _.size(results.snapshots) ? results.snapshots : '';

                    var dataForPDF = {
                        issueDistributionData: JSON.stringify(data.issueDistributionData),
                        issueDistributionColorsData: JSON.stringify(data.issueDistributionColorsData),

                        issueDistributionLegend_legend_array: JSON.stringify(data.issueDistributionLegend_legend_array),
                        issueDistributionLegend_color_array: JSON.stringify(data.issueDistributionLegend_color_array),
                        issueDistributionLegend_data_array: JSON.stringify(data.issueDistributionLegend_data_array),

                        issueDistributionMethodLevelData: JSON.stringify(data.issueDistributionMethodLevelData),
                        issueDistributionMethodLevelColorsData: JSON.stringify(data.issueDistributionMethodLevelColorsData),

                        designIssueMethodtLevelLegend_legend_array: JSON.stringify(data.designIssueMethodtLevelLegend_legend_array),
                        designIssueMethodtLevelLegend_color_array: JSON.stringify(data.designIssueMethodtLevelLegend_color_array),
                        designIssueMethodtLevelLegend_data_array: JSON.stringify(data.designIssueMethodtLevelLegend_data_array),

                        projectOverview: data.projectOverview,
                        trendGraphData: JSON.stringify(data.trendGraphData),
                        trendGraphLabel: JSON.stringify(data.trendGraphLabel),
                        kpiData: results.kpi,
                        hasKpiData: hasKpiData,
                        worseComponentList: worseComponentList.components,
                        riskComponentList: riskComponentList.components,
                        riskData: riskData,
                        hasRiskData: hasRiskData,
                        repositoryDashboardData: repositoryDashboardData,
                        codeIssuesData: JSON.stringify(codeIssuesData.d3Data),
                        codeIssuesLegendData: JSON.stringify(codeIssuesData.legendData),
                        moment: require('moment'),
                        version: version,
                        reportDownloadDate: reportDownloadDate,
                        metricViolationData: metricViolationData[0],
                        osPlatform: osPlatform,
                        changeOverviewData: changeOverviewData,
                        isPartial: isPartialLanguage
                    };
                    dataForPDF.pdfName = projectOverview.repository_name + "_" + getFormattedDate(projectOverview.project_details.snapshot.ts, timeZone, 'DD-MMM-YYYY_HH:mm');
                    resolve(dataForPDF);
                });
            });
        });
    }
    });
}
export function createPDFForDownload(res, dataForPDF){
    return new Promise ((resolve, reject)=>{
        var filePath = pathMod.join(__dirname,'./../../../component', 'views', 'pdf-report.pug');
        var basePath = pathMod.resolve('pdf_assets'); //  just relative path to absolute path

        var files = "file://";
        if (osPlatform == "win32") {
            files = "file:\\";
        }
        dataForPDF.basePath = files + basePath.replace(new RegExp(/\\/g), '/');

        pug.renderFile(filePath, dataForPDF,
            function (error, html) {
                if (error) {
                    log.debug(JSON.stringify(error));
                } else {
                    var options = {
                        header: {
                            "height": "5mm"
                        },
                        footer: {
                            "height": "10mm",
                            "contents": '<div id="footer"><table style="width:100%;"> <thead> <tr> <td > <div style="display:table;"> <div style="font-weight:normal; line-height:.2em; display:table-cell;' + ((dataForPDF.projectOverview.branch_name != "") ? " border-right:1px solid #999;" : "") + 'padding-right:0.5em; padding-left:0.5em;"> <p style="font-size:19px;line-height:16px;">' + dataForPDF.projectOverview.repository_name + '</p></div> <div style="font-weight:normal; line-height:.2em; display:table-cell; border-left:1px solid #999; padding-left:0.5em; padding-left:0.5em;"> <p style="font-size:19px;line-height:16px;"> Snapshot: ' + dataForPDF.projectOverview.project_details.snapshot.ts + '</p></div> <div style="font-weight:normal; line-height:.2em; display:table-cell; padding-right:0.5em; padding-left:0.5em;"> <p style="font-size:19px;line-height:16px;">' + dataForPDF.projectOverview.branch_name + '</p></div></div></td><td style="text-align:right;"> <div style="font-weight:normal; line-height:.2em;"> <p style="padding:0.5em 0; text-align:right;"><span style="color: #444; font-size:19px;">{{page}}</span></p></div></td></tr></thead></table></div>',
                        },
                        "base": dataForPDF.basePath,
                        "format": "A4",
                        "renderDelay": 1000,
                        // File options
                        "type": "pdf", // allowed file types: png, jpeg, pdf
                        "quality": "75", // only used for types png & jpeg

                        "border": {
                            "top": "16px", // default is 0, units: mm, cm, in, px
                            "right": "32px",
                            "bottom": "16px",
                            "left": "32px"
                        },
                    };

                    if(!gammaConfig.is_cloud || gammaConfig.is_cloud === "false") {
                        options.script = global.rootDir + "/phantom/pdf_a4_portrait.js";
                    }

                    return pdf.create(html, options).toStream(function (err, stream) {
                        if (!err) {
                            var filePath = stream.path;
                            var fileToSend = fs.readFileSync(filePath); // use fileTosend as email attachment for mailler

                            // prepare blob stream for downlaod
                            var mimetype = mime.lookup(filePath);
                            var stat = fs.statSync(filePath);
                            res.set('Content-Type', mimetype);
                            res.set('Content-Length', stat.size);
                            res.set('Content-Disposition', dataForPDF.pdfName + '.pdf');
                            resolve(fileToSend);
                        } else {
                            reject(err);
                            log.debug(err);
                        }
                    });
                }
            });
    });

}

function roundNumber(value, convertToInt) {
    if (convertToInt) {
        if (value === 0){
            return 0;
        }
        else if (value % 1 === 0){
            return parseInt(value);
        }
        else{
            return parseFloat(value).toFixed(2);
        }
    }
    else{
        return parseFloat(value).toFixed(2);//Math.round(value * 100) / 100;
    }
}

function createGraphData(designIssueList, selected_category) {
    var i = 0, j, obj, newDataObj = {};
    var excluded_antipatterns = ['CSS', 'CSW', 'CSI'];
    has_components = false;
    graphData = { 'component_level_antipatterns': [], 'method_level_antipatterns': [] };
    var d3Data = [], d3DataObj = {};
    var packageList = designIssueList.dataList[0];
    var componentList;
    if (selected_category == 'component_level_antipatterns') {
        componentList = designIssueList.dataList[1].components_designissue_detail;
        master_antipattern_list = designIssueList.component_level_antipattern_list;
    }
    else {
        componentList = designIssueList.dataList[1].subcomponents_designissue_detail;
        master_antipattern_list = designIssueList.method_level_antipattern_list;
    }

    // pushing different types of antipatterns in stackdata which will be used to plot graph
    var stackData = [], colorsData = [];
    for (i = 0; i < master_antipattern_list.length; i++) {
        if (excluded_antipatterns.indexOf(master_antipattern_list[i].type) == -1) {
            stackData.push(master_antipattern_list[i].type);
            if (selected_category == 'component_level_antipatterns'){
                colorsData.push(component_level_antipattern_colors[master_antipattern_list[i].type]);
            }
            else if (selected_category == 'method_level_antipatterns'){
                colorsData.push(method_level_antipattern_colors[master_antipattern_list[i].type]);
            }
        }
    }

    // // checking if component directly exists in current module
    for (i = 0; i < componentList.length; i++) {
        if (excluded_antipatterns.indexOf(componentList[i].type) == -1 && componentList[i].value != 0){
            has_components = true;
        }
    }

    // soring the data based on number of issues
    packageList.sort(function (a, b) {
        var a_value = 0, b_value = 0;
        for (i = 0; i < a['antipattern_issue_details'].length; i++) {
            if (excluded_antipatterns.indexOf(a['antipattern_issue_details'][i].type) == -1){
                a_value = a_value + a['antipattern_issue_details'][i].value;
            }
        }
        for (i = 0; i < b['antipattern_issue_details'].length; i++) {
            if (excluded_antipatterns.indexOf(b['antipattern_issue_details'][i].type) == -1){
                b_value = b_value + b['antipattern_issue_details'][i].value;
            }
        }
        return parseInt(b_value) - parseInt(a_value);
    });

    for (j = 0; j < packageList.length; j++) {
        obj = { 'id': packageList[j].id, 'name': packageList[j].name, 'type': packageList[j].type, 'sig': packageList[j].sig };
        for (i = 0; i < master_antipattern_list.length; i++) {
            if (excluded_antipatterns.indexOf(master_antipattern_list[i].type) == -1){
                obj[master_antipattern_list[i].type] = 0;
            }
        }
        for (i = 0; i < packageList[j]['antipattern_issue_details'].length; i++) {
            if (excluded_antipatterns.indexOf(packageList[j]['antipattern_issue_details'][i].type) == -1){
                obj[packageList[j]['antipattern_issue_details'][i].type] = packageList[j]['antipattern_issue_details'][i].value;
            }
        }
        graphData[selected_category].push(obj);
    }
    // creating data in d3js format
    for (var k = 0; k < stackData.length; k++) {
        newDataObj = {
            name: stackData[k],
            data: []
        }
        d3Data.push(newDataObj);
        var showHandOnHover;
        showHandOnHover = true;
        // inserting actual data
        for (j = 0; j < graphData[selected_category].length; j++) {
            d3DataObj = { module: graphData[selected_category][j].name, value: graphData[selected_category][j][stackData[k]], id: graphData[selected_category][j].id, name: "Modules", valueField: stackData[k], showHandOnHover: showHandOnHover };
            d3Data[k].data.push(d3DataObj);
        }
        if (has_components) {
            // inserting blanck space to give space between module and components
            d3DataObj = { module: '', value: 0, id: '', name: ' ', valueField: stackData[k], showHandOnHover: false };
            d3Data[k].data.push(d3DataObj);

            // inserting components at the end
            d3DataObj = { module: 'Components', value: 0, id: '', name: 'Components', valueField: stackData[k], showHandOnHover: showHandOnHover };
            for (i = 0; i < componentList.length; i++) {
                if (((stackData[k]).toLowerCase() == (componentList[i]['type']).toLowerCase())){
                    d3DataObj.value = d3DataObj.value + parseInt(componentList[i]['value']);
                }
            }
            d3Data[k].data.push(d3DataObj);
        }
    }
    if (d3Data.length == 0) {
        newDataObj = {
            name: "",
            data: []
        };
        d3Data.push(newDataObj);
    }

    return { d3Data: d3Data, colorsData: colorsData };
}

function createLegendData(designIssueList, selected_category) {
    var i, j, obj1, has_components = false;
    var excluded_antipatterns = ['CSS', 'CSW', 'CSI'];
    var packageList = designIssueList.dataList[0];
    var componentList;
    if (selected_category == 'component_level_antipatterns'){
        componentList = designIssueList.dataList[1].components_designissue_detail;
    }
    else{
        componentList = designIssueList.dataList[1].subcomponents_designissue_detail;
    }

    legendData = { 'component_level_antipatterns': [], 'method_level_antipatterns': [] };
    // Adding blank data initially
    obj1 = { 'id': '', 'name': '', 'type': '', 'sig': '' };
    for (i = 0; i < master_antipattern_list.length; i++) {
        if (excluded_antipatterns.indexOf(master_antipattern_list[i].type) == -1){
            obj1[master_antipattern_list[i].type] = 0;
        }
    }
    legendData[selected_category].push(obj1);

    //Adding actual data
    for (j = 0; j < packageList.length; j++) {
        obj1 = { 'id': packageList[j].id, 'name': packageList[j].name, 'type': packageList[j].type, 'sig': packageList[j].sig };
        for (i = 0; i < master_antipattern_list.length; i++) {
            if (excluded_antipatterns.indexOf(master_antipattern_list[i].type) == -1){
                obj1[master_antipattern_list[i].type] = 0;
            }
        }
        for (i = 0; i < packageList[j]['antipattern_issue_details'].length; i++) {
            if (packageList[j]['antipattern_issue_details'][i].type != 'CSS' && packageList[j]['antipattern_issue_details'][i].type != 'CSW' && packageList[j]['antipattern_issue_details'][i].type != 'CSI'){
                obj1[packageList[j]['antipattern_issue_details'][i].type] = packageList[j]['antipattern_issue_details'][i].value;
            }
        }
        legendData[selected_category].push(obj1);
    }

    // Adding blank data to give space batween module and components
    obj1 = { 'id': '', 'name': '', 'type': '', 'sig': '' };
    for (i = 0; i < master_antipattern_list.length; i++) {
        if (excluded_antipatterns.indexOf(master_antipattern_list[i].type) == -1){
            obj1[master_antipattern_list[i].type] = 0;
        }
    }
    legendData[selected_category].push(obj1);

    // Adding Component data at the end
    obj1 = { 'id': '', 'name': 'Components', 'type': '', 'sig': '' };
    for (i = 0; i < master_antipattern_list.length; i++) {
        if (master_antipattern_list[i].type != 'CSS' && master_antipattern_list[i].type != 'CSW' && master_antipattern_list[i].type != 'CSI'){
            obj1[master_antipattern_list[i].type] = 0;
        }
    }
    for (i = 0; i < componentList.length; i++) {
        if (excluded_antipatterns.indexOf(componentList[i].type) == -1){
            obj1[componentList[i].type] = obj1[componentList[i].type] + parseInt(componentList[i]['value']);
        }

        if (parseInt(componentList[i]['value']) !== 0){
            has_components = true;
        }
    }
    if (has_components){
        legendData[selected_category].push(obj1);
    }

    var legend_array = [], color_array = [];
    for (var i = 0; i < master_antipattern_list.length; i++) {
        if (master_antipattern_list[i].type != 'CSS' && master_antipattern_list[i].type != 'CSW' && master_antipattern_list[i].type != 'CSI') {
            if (master_antipattern_list[i].type == "FIC") {
                legend_array.push(translation[language][master_antipattern_list[i].type] + " C");
            } else {
                legend_array.push(translation[language][master_antipattern_list[i].type]);
            }
            color_array.push(getDesignIssueObject(master_antipattern_list[i].type, selected_category).color);
        }
    }
    var data_array = getDesignIssueInfo(0, selected_category);
    var showHandOnHover = true;
    // color_array = _.without(color_array,'null',null);
    // legend_array = _.without(legend_array,'null',null);

    return { legend_array: legend_array, color_array: color_array, data_array: data_array };
}

/* Get design information for legend for all packages or for particular package  */
function getDesignIssueInfo(legend_value, selected_category) {
    var data_array = {}, i;
    for (i = 0; i < master_antipattern_list.length; i++) {
        if (master_antipattern_list[i].type == "FIC") {
            data_array[translation[language][master_antipattern_list[i].type] + " C"] = ['', 0, ''];
        } else {
            data_array[translation[language][master_antipattern_list[i].type]] = ['', 0, ''];
        }
    }
    var dataList = legendData[selected_category];
    if (legend_value === 0) {
        for (i = 0; i < dataList.length; i++) {
            _.each(dataList[i], function (value, key) {
                if (key != 'id' && key != 'name' && key != 'type' && key != 'sig') {
                    if (key == "FIC") {
                        var newKey = translation[language][key] + " C";
                    } else {
                        var newKey = translation[language][key];
                    }
                    var obj = getDesignIssueObject(key, selected_category);
                    if (obj != undefined) {
                        var transkey = obj.criticality;
                        data_array[newKey][0] = translation[language][transkey];
                        data_array[newKey][1] = data_array[newKey][1] + parseInt(value);
                        data_array[newKey][2] = '';
                    }
                }
            });
        }
    }
    else {
        var antipatterninfo = dataList[legend_value];
        _.each(antipatterninfo, function (value, key) {
            if (key != 'id' && key != 'name' && key != 'type' && key != 'sig') {
                if (key == "FIC") {
                    var newKey = translation[language][key] + " C";
                } else {
                    var newKey = translation[language][key];
                }
                var obj = getDesignIssueObject(key, selected_category);
                if (obj != undefined) {
                    var transkey = obj.criticality;
                    data_array[newKey][0] = translation[language][transkey];
                    data_array[newKey][1] = value;
                }
            }
        });
    }

    return data_array;
}

function getDesignIssueObject(type, selected_category) {
    for (var i = 0, len = master_antipattern_list.length; i < len; i++) {
        if (master_antipattern_list[i].type == type) {
            var obj = {};
            obj.ruletypeid = master_antipattern_list[i].ruletypeid;
            obj.type = master_antipattern_list[i].type;
            obj.criticality = master_antipattern_list[i].criticality;
            if (selected_category == 'component_level_antipatterns'){
                obj.color = component_level_antipattern_colors[master_antipattern_list[i].type];
            }
            else{
                obj.color = method_level_antipattern_colors[master_antipattern_list[i].type];
            }
            return obj;
        }
    }
}

//----- Create graph json in d3 graph format ------------
function prepareIssueData(data) {

    var criticalArray = [];
    var highArray = [];
    var mediumArray = [];
    var lowArray = [];
    var uncategorisedArray = [];
    var infoArray = [];

    var sort = { "critical": 1, "high": 2, "medium": 3, "low": 4, "uncategorised": 5, 'info': 6 };
    _.each(data.dataList, (v, k) => {
        _.each(v, (val, key) => {
            _.each(val.code_issue, (issueValue, issuekey) => {
                var obj = {};
                obj.module = issueValue.name;
                obj.valueField = issueValue.type;
                obj.value = issueValue.value;
                obj.sort = sort[issueValue.type];

                if (obj.valueField == "info") {
                    var findResult = _.find(infoArray, function (findObj) { return findObj.module == obj.module; });
                    if (findResult != undefined) {

                        // map and update object value
                        _.map(infoArray, function (mapObj) {
                            if (mapObj.module == obj.module) {
                                mapObj.value = (+mapObj.value) + (+obj.value); // Or replace the whole obj
                            }
                        });

                    } else {
                        // push value to array
                        infoArray.push(obj);
                        // prepare other array also
                        var obj2 = _.clone(obj);
                        obj2.value = "0";
                        criticalArray.push(obj2);
                        highArray.push(obj2);
                        mediumArray.push(obj2);
                        lowArray.push(obj2);
                        uncategorisedArray.push(obj2);
                    }
                }

                if (obj.valueField == "critical") {
                    var findResult = _.find(criticalArray, function (findObj) { return findObj.module == obj.module; });
                    if (findResult != undefined) {

                        // map and update object value
                        _.map(criticalArray, function (mapObj) {
                            if (mapObj.module == obj.module) {
                                mapObj.value = (+mapObj.value) + (+obj.value); // Or replace the whole obj
                            }
                        });

                    } else {
                        // push value to array
                        criticalArray.push(obj);

                        // prepare other array also
                        var obj2 = _.clone(obj);
                        obj2.value = "0";
                        infoArray.push(obj2);
                        highArray.push(obj2);
                        mediumArray.push(obj2);
                        lowArray.push(obj2);
                        uncategorisedArray.push(obj2);
                    }
                }

                if (obj.valueField == "high") {
                    var findResult = _.find(highArray, function (findObj) { return findObj.module == obj.module; });
                    if (findResult != undefined) {

                        // map and update object value
                        _.map(highArray, function (mapObj) {
                            if (mapObj.module == obj.module) {
                                mapObj.value = (+mapObj.value) + (+obj.value); // Or replace the whole obj
                            }
                        });

                    } else {
                        // push value to array
                        highArray.push(obj);

                        // prepare other array also
                        var obj2 = _.clone(obj);
                        obj2.value = "0";
                        infoArray.push(obj2);
                        criticalArray.push(obj2);
                        mediumArray.push(obj2);
                        lowArray.push(obj2);
                        uncategorisedArray.push(obj2);
                    }
                }

                if (obj.valueField == "medium") {
                    var findResult = _.find(mediumArray, function (findObj) { return findObj.module == obj.module; });
                    if (findResult != undefined) {

                        // map and update object value
                        _.map(mediumArray, function (mapObj) {
                            if (mapObj.module == obj.module) {
                                mapObj.value = (+mapObj.value) + (+obj.value); // Or replace the whole obj
                            }
                        });

                    } else {
                        // push value to array
                        mediumArray.push(obj);

                        // prepare other array also
                        var obj2 = _.clone(obj);
                        obj2.value = "0";
                        infoArray.push(obj2);
                        highArray.push(obj2);
                        criticalArray.push(obj2);
                        lowArray.push(obj2);
                        uncategorisedArray.push(obj2);
                    }
                }

                if (obj.valueField == "low") {
                    var findResult = _.find(lowArray, function (findObj) { return findObj.module == obj.module; });
                    if (findResult != undefined) {

                        // map and update object value
                        _.map(lowArray, function (mapObj) {
                            if (mapObj.module == obj.module) {
                                mapObj.value = (+mapObj.value) + (+obj.value); // Or replace the whole obj
                            }
                        });

                    } else {
                        // push value to array
                        lowArray.push(obj);

                        // prepare other array also
                        var obj2 = _.clone(obj);
                        obj2.value = "0";
                        infoArray.push(obj2);
                        highArray.push(obj2);
                        mediumArray.push(obj2);
                        criticalArray.push(obj2);
                        uncategorisedArray.push(obj2);
                    }
                }

                if (obj.valueField == "uncategorised") {
                    var findResult = _.find(uncategorisedArray, function (findObj) { return findObj.module == obj.module; });
                    if (findResult != undefined) {

                        // map and update object value
                        _.map(uncategorisedArray, function (mapObj) {
                            if (mapObj.module == obj.module) {
                                mapObj.value = (+mapObj.value) + (+obj.value); // Or replace the whole obj
                            }
                        });

                    } else {
                        // push value to array
                        uncategorisedArray.push(obj);

                        // prepare other array also
                        var obj2 = _.clone(obj);
                        obj2.value = "0";
                        infoArray.push(obj2);
                        highArray.push(obj2);
                        mediumArray.push(obj2);
                        lowArray.push(obj2);
                        criticalArray.push(obj2);
                    }
                }
            });

            _.each(val, (issueValue1, issuekey1) => {
                var keyObject = _.find(data.issueNameList, function (item) {
                    return issueValue1.name == item.name;
                });
                if (keyObject != undefined) {
                    var componentObj = {};
                    componentObj.module = issueValue1.name;
                    componentObj.valueField = keyObject.criticality;
                    componentObj.value = issueValue1.value;
                    componentObj.sort = sort[keyObject.criticality];

                    if (componentObj.valueField == "info") {
                        var findResult = _.find(infoArray, function (findObj) { return findObj.module == componentObj.module; });
                        if (findResult != undefined) {

                            // map and update object value
                            _.map(infoArray, function (mapObj) {
                                if (mapObj.module == componentObj.module) {
                                    mapObj.value = (+mapObj.value) + (+componentObj.value); // Or replace the whole obj
                                }
                            });

                        } else {
                            // push value to array
                            infoArray.push(componentObj);
                            // prepare other array also
                            var obj2 = _.clone(componentObj);
                            obj2.value = "0";
                            criticalArray.push(obj2);
                            highArray.push(obj2);
                            mediumArray.push(obj2);
                            lowArray.push(obj2);
                            uncategorisedArray.push(obj2);
                        }
                    }

                    if (componentObj.valueField == "critical") {
                        var findResult = _.find(criticalArray, function (findObj) { return findObj.module == componentObj.module; });
                        if (findResult != undefined) {

                            // map and update object value
                            _.map(criticalArray, function (mapObj) {
                                if (mapObj.module == componentObj.module) {
                                    mapObj.value = (+mapObj.value) + (+componentObj.value); // Or replace the whole obj
                                }
                            });

                        } else {
                            // push value to array
                            criticalArray.push(componentObj);

                            // prepare other array also
                            var objClone = _.clone(componentObj);
                            objClone.value = "0";
                            infoArray.push(objClone);
                            highArray.push(objClone);
                            mediumArray.push(objClone);
                            lowArray.push(objClone);
                            uncategorisedArray.push(objClone);
                        }
                    }

                    if (componentObj.valueField == "high") {
                        var findResult = _.find(highArray, function (findObj) { return findObj.module == componentObj.module; });
                        if (findResult != undefined) {

                            // map and update object value
                            _.map(highArray, function (mapObj) {
                                if (mapObj.module == componentObj.module) {
                                    mapObj.value = (+mapObj.value) + (+componentObj.value); // Or replace the whole obj
                                }
                            });

                        } else {
                            // push value to array
                            highArray.push(componentObj);

                            // prepare other array also
                            var objClone = _.clone(componentObj);
                            objClone.value = "0";
                            infoArray.push(objClone);
                            criticalArray.push(objClone);
                            mediumArray.push(objClone);
                            lowArray.push(objClone);
                            uncategorisedArray.push(objClone);
                        }
                    }

                    if (componentObj.valueField == "medium") {
                        var findResult = _.find(mediumArray, function (findObj) {
                            return findObj.module == componentObj.module;
                        });
                        if (findResult != undefined) {

                            // map and update object value
                            _.map(mediumArray, function (mapObj) {
                                if (mapObj.module == componentObj.module) {
                                    mapObj.value = (+mapObj.value) + (+componentObj.value); // Or replace the whole obj
                                }
                            });

                        } else {
                            // push value to array
                            mediumArray.push(componentObj);

                            // prepare other array also
                            var objClone = _.clone(componentObj);
                            objClone.value = "0";
                            infoArray.push(objClone);
                            highArray.push(objClone);
                            criticalArray.push(objClone);
                            lowArray.push(objClone);
                            uncategorisedArray.push(objClone);
                        }
                    }

                    if (componentObj.valueField == "low") {
                        var findResult = _.find(lowArray, function (findObj) { return findObj.module == componentObj.module; });
                        if (findResult != undefined) {

                            // map and update object value
                            _.map(lowArray, function (mapObj) {
                                if (mapObj.module == componentObj.module) {
                                    mapObj.value = (+mapObj.value) + (+componentObj.value); // Or replace the whole obj
                                }
                            });

                        } else {
                            // push value to array
                            lowArray.push(componentObj);

                            // prepare other array also
                            var objClone = _.clone(componentObj);
                            objClone.value = "0";
                            infoArray.push(objClone);
                            highArray.push(objClone);
                            mediumArray.push(objClone);
                            criticalArray.push(objClone);
                            uncategorisedArray.push(objClone);
                        }
                    }

                    if (componentObj.valueField == "uncategorised") {
                        var findResult = _.find(uncategorisedArray, function (findObj) { return findObj.module == componentObj.module; });
                        if (findResult != undefined) {
                            // map and update object value
                            _.map(uncategorisedArray, function (mapObj) {
                                if (mapObj.module == componentObj.module) {
                                    mapObj.value = (+mapObj.value) + (+componentObj.value); // Or replace the whole obj
                                }
                            });

                        } else {
                            // push value to array
                            uncategorisedArray.push(componentObj);

                            // prepare other array also
                            var objClone = _.clone(componentObj);
                            objClone.value = "0";
                            infoArray.push(objClone);
                            highArray.push(objClone);
                            mediumArray.push(objClone);
                            lowArray.push(objClone);
                            criticalArray.push(objClone);
                        }
                    }
                }

            });
        });
    });


    var d3Data = [
        {
            "name": "critical",
            "data": _.first(_.sortBy(criticalArray, 'sort'), 15)
        },
        {
            "name": "high",
            "data": _.first(_.sortBy(highArray, 'sort'), 15)
        },
        {
            "name": "medium",
            "data": _.first(_.sortBy(mediumArray, 'sort'), 15)
        },
        {
            "name": "low",
            "data": _.first(_.sortBy(lowArray, 'sort'), 15)
        },
        {
            "name": "uncategorised",
            "data": _.first(_.sortBy(uncategorisedArray, 'sort'), 15)
        },
        {
            "name": "info",
            "data": _.first(_.sortBy(infoArray, 'sort'), 15)
        },
    ];

    var sortingData = [
        {
            "name": "critical",
            "data": criticalArray
        },
        {
            "name": "high",
            "data": highArray
        },
        {
            "name": "medium",
            "data": mediumArray
        },
        {
            "name": "low",
            "data": lowArray
        },
        {
            "name": "uncategorised",
            "data": uncategorisedArray
        },
        {
            "name": "info",
            "data": infoArray
        },
    ];

    var legendData = [
        { "name": "critical", 'value': 0 },
        { "name": "high", 'value': 0 },
        { "name": "medium", 'value': 0 },
        { "name": "low", 'value': 0 },
        { "name": "uncategorised", 'value': 0 },
        { "name": "info", 'value': 0 }
    ];

    _.each(sortingData, (value, key) => {
        _.each(value.data, (value1, key1) => {
            _.map(legendData, function (mapObj) {
                if (mapObj.name == value1.valueField) {
                    mapObj.value = (+mapObj.value) + (+value1.value);
                }
            });
        });
    });

    var legenDataArray = {};

    _.each(legendData, (value, key) => {
        var valueArray = [];
        valueArray.push(value.value);
        // valueArray.push("10");
        var arrayKey = value.name.charAt(0).toUpperCase() + value.name.slice(1);
        legenDataArray[arrayKey] = valueArray;
    });

    return { d3Data: d3Data, legendData: legenDataArray }
}

function prepareMetricData(metricsData) {
    var i = 0, j, newDataObj = {}, d3Data = [], d3DataObj = {};
    var stackData = ["violations", "no_violations"];
    var metricsList = metricsData.metrics;

    // creating data in d3js format
    for (var k = 0; k < stackData.length; k++) {
        newDataObj = {
            name: stackData[k],
            data: []
        };
        d3Data.push(newDataObj);
        var showHandOnHover;
        if (stackData[k] == 'violations'){
            showHandOnHover = true;
        }
        else{
            showHandOnHover = false;
        }
        for (j = 0; j < metricsList.length; j++) {
            //if (metricsList[j].type != "NOPM" && metricsList[j].type != "NOSM" )
            if (_.indexOf(metrics_list, metricsList[j].type) != -1) {
                var existing_metric = isAlreadyExists(d3Data, metricsList[j].type, stackData[k]);
                if (existing_metric !== null) {
                    if (stackData[k] == 'violations'){
                        existing_metric.value = (checked_params.indexOf(stackData[k]) !== -1) ? parseInt(existing_metric.value) + parseInt(metricsList[j].value) : 0;
                    }
                    else{
                        existing_metric.value = (checked_params.indexOf(stackData[k]) !== -1) ? parseInt(metricsData.total_components.components) - parseInt(metricsList[j].value) : 0;
                    }
                }
                else {
                    var value;
                    if (stackData[k] == 'violations'){
                        value = (checked_params.indexOf('violations') !== -1) ? parseInt(metricsList[j].value) : 0;
                    }
                    else{
                        value = (checked_params.indexOf('no_violations') !== -1) ? parseInt(metricsData.total_components.components) - parseInt(metricsList[j].value) : 0;
                    }
                    d3DataObj = { module: metricsList[j].type, value: value, id: j + 1, valueField: stackData[k], showHandOnHover: showHandOnHover }
                    d3Data[k].data.push(d3DataObj)
                }
            }
        }
    }

    return d3Data;
}

function isAlreadyExists(d3Data, metric_type, type) {
    if (type == 'violations') {
        if (d3Data[0].data.length > 0) {
            for (var i = 0; i < d3Data[0].data.length; i++) {
                if (d3Data[0].data[i].module == metric_type){
                    return d3Data[0].data[i];
                }
            }
            return null;
        }
        else {
            return null;
        }

    }
    else {
        if (d3Data[1].data.length > 0) {

            for (var i = 0; i < d3Data[1].data.length; i++) {
                if (d3Data[1].data[i].module == metric_type){
                    return d3Data[1].data[i];
                }
            }
            return null;
        }
        else {
            return null;
        }
    }
}
function getFormattedDate(timestamp, timeZone = "", format = "DD-MMM-YYYY HH:mm") {
    // timestamp = timestamp.substr(0, timestamp.length - 1);
    timestamp = new Date(timestamp).getTime();
    var ms = moment(timestamp);

    //ms.add(330,'minutes');
    // var d = new Date();
    // var n = d.getTimezoneOffset();
    // ms.add(-n, 'minutes');

    if (format) {
        if (timeZone != null && timeZone != "") {
            return ms.tz(timeZone).format(format);
        } else {
            return ms.format(format);
        }
    } else {
        return timestamp;
    }
};
