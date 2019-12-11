import { getPercentage, getComponentDuplicationSummary } from './../../v1/repository/duplication/duplication.controller';
import { getUnitTestCount } from './../../v1/repository/unittests/unitTest.controller';
import { getRatingsData } from './../../v1/repository/ratings/rating.controller';
import { getDesignIssueCount, getDesignIssueSummary } from './../../v1/repository/designIssues/designIssues.controller';
import { getCodeIssueCount, getCodeIssueSummary } from './../../v1/repository/codeIssues/codeIssues.controller';
import { getHotspotCount } from './../../v1/repository/hotspots/hotspots.controller';
import { getMetricsData } from './../../v1/repository/metrics/metric.controller';
import { getComponentCount } from './../../v1/repository/components/components.controller';
import { getLatestNodeSnapshotForRepo } from './../../../services/repository';

const errors = require('throw.js');

export async function getNodeSummary(req, res, next) {
    let repoDetails = {
        'repositoryId': req.query.repositoryId,
        'snapshotId': req.query.snapshotId,
        'nodeId': req.query.nodeId,
        'tenantUid': req.session.tenant_uid
    };
    Promise.all([getRatingsData(req, repoDetails, next), getDesignIssueCount(req, repoDetails, next), getCodeIssueCount(req, repoDetails, next), getHotspotCount(req, repoDetails, next), getPercentage(req, repoDetails, next), getUnitTestCount(req, repoDetails, next)])
    .then(values => {
        let nodeSummary = {
            'health': null,
            'statistics': {},
            'hotspot': [],
            'metrics': [],
            'duplication': values[4].duplication,
            'design_issues': [],
            'ratings': values[0],
            'code_issues_severity': [],
            'issues': values[2].codeIssues + values[1].componentDesignIssues + values[1].subcomponentDesignIssues,
            'tasks': 0,
            'unit_tests': values[5].unittests,
            'tags_data': [],
            'duplicateLoc': null,
            'clones': null,
            'occurences': null,
            'code_issues_count': values[2].codeIssues,
            'design_issues_count': values[1].componentDesignIssues + values[1].subcomponentDesignIssues,
            'hotspot_count': values[3].hotspots,
            'subcomponent_design_issues_count': values[1].subcomponentDesignIssues
        };

        res.status(200).json(nodeSummary);
    })
    .catch(error=>{
        let errorLog = new errors.InternalServerError(error.message, 1018);
        return next(errorLog);
    });
}

export async function getComponentSummary(req, res, next) {
    let repoDetails = {
        'repositoryId': req.query.repositoryId,
        'snapshotId': req.query.snapshotId,
        'nodeId': req.query.nodeId,
        'tenantUid': req.session.tenant_uid,
        'nodeType': 'COMPONENTS'
    };
    Promise.all([getRatingsData(req, repoDetails, next), getDesignIssueCount(req, repoDetails, next), getDesignIssueSummary(req, repoDetails, next), getCodeIssueCount(req, repoDetails, next), getCodeIssueSummary(req, repoDetails, next), getMetricsData(req, repoDetails, next), getPercentage(req, repoDetails, next), getComponentDuplicationSummary(req, repoDetails, next), getComponentRiskDetails(req, repoDetails, next)])
    .then(values => {
        //console.log(values);
        let componentSummary = {
            "component_name": "",
            "component_type": "",
            "sig": "",
            "ratings": values[0],
            "design_issues_count": values[1].componentDesignIssues + values[1].subcomponentDesignIssues,
            "antipatterns": values[2].designIssues,
            "code_issues_count": values[3].codeIssues,
            "code_issues": values[4].codeIssues,
            "metrics": values[5].metrics,
            "duplicationPercentage": values[6].duplication,
            "duplication": {
                "duplicateLoc": values[7].duplicate_loc,
                "clones": values[7].clones,
                "occurences": values[7].occurences,
            },
            "issues_count": values[3].codeIssues + values[1].componentDesignIssues + values[1].subcomponentDesignIssues,
            "loc_details": {
                "exec_loc": "",
                "total_loc": ""
            },
            "issues": values[3].codeIssues + values[1].componentDesignIssues + values[1].subcomponentDesignIssues,
            "tasks": "",
            "tags_data": [],
            "risk": values[8].risk,
            "synopsis": values[8].synopsis
        };
        res.status(200).json(componentSummary);
    })
    .catch(error => {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        return next(errorLog);
    });
}

export async function getFileSummary(req, res, next) {
    let repoDetails = {
        'repositoryId': req.query.repositoryId,
        'snapshotId': req.query.snapshotId,
        'nodeId': req.query.nodeId,
        'tenantUid': req.session.tenant_uid,
        'nodeType': 'FILES'
    };
    Promise.all([getDesignIssueCount(req, repoDetails, next), getCodeIssueCount(req, repoDetails, next), getCodeIssueSummary(req, repoDetails, next), getMetricsData(req, repoDetails, next), getFileComponentDetails(req, repoDetails, next)])
    .then(values => {
        let componentSummary = {
            "design_issues_count": values[0].componentDesignIssues + values[0].subcomponentDesignIssues,
            "code_issues_count": values[1].codeIssues,
            "code_issues": values[2].codeIssues,
            "metrics": values[3].metrics,
            "component_details": values[4],
            "issues": values[1].codeIssues + values[0].componentDesignIssues + values[0].subcomponentDesignIssues,
        };
        res.status(200).json(componentSummary);
    })
    .catch(error => {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        return next(errorLog);
    });
}

export async function getLocAndComponents(req, res, next) {
    let repoDetails = {
        'repositoryId': req.query.repositoryId,
        'snapshotId': req.query.snapshotId,
        'nodeId': req.query.nodeId,
        'tenantUid': req.session.tenant_uid
    };
    Promise.all([getMetricsData(req, repoDetails, next), getComponentCount(req, repoDetails, next)])
    .then(values => {
        let locAndComponents = {
            'total_loc': ((values[0].metrics).filter(d=>(d.metricName == 'LOC')))[0].value,
            'loc': ((values[0].metrics).filter(d => (d.metricName == 'NOS')))[0].value,
            'components': parseInt(values[1].components)
        };
        res.status(200).json(locAndComponents);
    })
    .catch(error => {
        let errorLog = new errors.InternalServerError(error.message, 1018);
        return next(errorLog);
    });
}

export async function getActiveLanguage(req, res, next) {
    return getLatestNodeSnapshotForRepo(req, next)
    .then(data => {
        let snapshotId = (req.query.snapshotId) ? req.query.snapshotId : data[0].snapshot_id;
        let sqlQuery = `select convert_from(content,'UTF-8') from snapshot_contents where snapshotid =$1 and key = 'languagesProcessed';`;
        return req.corona.query(sqlQuery, [snapshotId], next)
        .then(data => {
            if (data.length) {
                var dataResponse = (data[0].convert_from).split(",");
                if(res) {
                    res.status(200).json(dataResponse);
                }
                else {
                    return dataResponse;
                }
            } else {
                if(res) {
                    res.status(200).json([]);
                }
                else {
                    return dataResponse;
                }
            }
        });
    });
}

function getFileComponentDetails(req, repoDetails, next) {
    sqlQuery = `select n.id,n.displayname,n.kind,n.signature from nodes n
                inner join node_file nf
                on nf.component_id=n.id
                where n.classification='T' and nf.snapshot_id=$1 and nf.file_id=$2
                group by n.id,n.displayname,n.kind,n.signature`;
    return req.corona.query(sqlQuery, [repoDetails.snapshotId, repoDetails.nodeId], next)
    .then(components=>{
        return components;
    });
}

function getComponentRiskDetails(req, repoDetails, next) {
    let sqlQuery = `select rating,synopsis from relevance where nodeid=$1 and snapshot_id=$2`;
    return req.corona.query(sqlQuery, [repoDetails.nodeId, repoDetails.snapshotId], next)
    .then(results => {
        let riskDetails = {};
        if (results.length) {
            riskDetails.risk = parseFloat(results[0].rating).toFixed(2);
            riskDetails.synopsis = results[0].synopsis;
        } else {
            riskDetails.risk = 'NA';
            riskDetails.synopsis = '';
        }
        return riskDetails;
    });
}