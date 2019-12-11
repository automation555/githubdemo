/**
 * Module dependencies.
 */

import nodesService from './../../../services/nodes'
import _ from 'underscore';

//Expose Modules
// module.exports.getPluginName = () => 'Code coverage';

var sqlParams = (req, res, next) => {
    req.sqlKeys = [];
    req.sqlPair = {};
    req.pushSqlParams = (value, key) => {
        var index = '';
        if (req.sqlPair[key])
            return req.sqlPair[key]

        req.sqlKeys.push(value)

        if (_.isArray(value))
            index_t = ' ANY($' + req.sqlKeys.length + ') '
        else
            index_t = '$' + req.sqlKeys.length

        req.sqlPair[key] = index_t;
        return index_t;
    }
}

var CoverageSqlConstraint = {
    select: ['lineCoverage', 'branchCoverage', 'branchCoverage_total', 'branchCoverage_percentage', '(lineCoverage::float/greatest(measurements.value::float,1)*100) as lineCoverage_percentage'],
    join: (req) => {
        var query = `
    (
        select nodes.parentid as node_id,
        sum(method_coverage.linescovered) as lineCoverage,
        sum(conditions) as branchCoverage_total,
        sum(coveredconditions) as branchCoverage,
        (sum(coveredconditions)::float/greatest(sum(conditions)::float,1))*100 as branchCoverage_percentage
        from method_coverage
        inner join nodes on method_coverage.nodeid=nodes.id
        where
        nodes.classification='F'
        AND method_coverage.snapshotid =${req.pushSqlParams(req.query.snapshot_id, 'snapshot_id')}
        AND nodes.subsystem_id=${req.pushSqlParams(req.query.project_id, 'project_id')}
        group by node_id
    ) node_coverage on (node_coverage.node_id=nodes.id)
    `
        return query;
    }
}



export async function getCoverageExplorer(req, res, next) {
    sqlParams(req, res, next)
    var query = `
    SELECT fd.*,
        branch_coverage_details,
        line_coverage_details
    FROM   get_component_file_details($1,$2,$3) fd
        left outer JOIN (SELECT line_coverage.fileid,
                            json_agg(line_coverage.*) AS line_coverage_details,
                            json_agg(branch_coverage.*) AS branch_coverage_details
                    FROM   line_coverage
                    LEFT OUTER JOIN branch_coverage ON branch_coverage.linecoverageid = line_coverage.id
                    where  line_coverage.snapshotid=$2
                    GROUP  BY line_coverage.fileid) agg
                ON agg.fileid = fd.id
        inner join nodes ON nodes.id = fd.id

    `;
    req.corona.query(query, [req.query.project_id, req.query.snapshot_id, req.query.node_id], next)
        .then(data => {
            data.forEach(d => {
                d.branch_coverage_details = _.compact(d.branch_coverage_details)
            })
            var query = `
            select *
            from
            (
                select sum(method_coverage.linescovered) as lineCoverage,
                sum(coveredconditions) as branchCoverage,
                sum(conditions) as branchCoverage_total,
                count(*) methods_covered
                from method_coverage
                where method_coverage.nodeid in (select id from nodes where parentid= $1) and method_coverage.snapshotid=$2
            ) mc,
            (
                select json_agg(jsonb_build_array(measurename,value)) as measures_all
                from nodes
                INNER JOIN measurements ON (nodes.id=measurements.nodeid)
                INNER JOIN measures on measurements.measureid=measures.id
                where nodes.id=$1
                AND measurements.snapshotid=$2
                AND nodes.subsystem_id=$3
                AND measurements.measureid in (SELECT id FROM   measures WHERE  measurename in ('LOC','NOM'))
            ) ma,
            ${nodesService.nodeLOC(req, req.query.node_id)}
            `

            req.corona.query(query, [req.query.node_id, req.query.snapshot_id, req.query.project_id], next)
                .then(method_data => {
                    // method_data[0].loc = _.reduce(data, function (num,d) { return (d.loc-0) + num; }, 0);
                    var d_data = method_data[0];
                    if (!d_data)
                        return res.json({})

                    d_data.files = data;
                    if (d_data.measures_all) {
                        d_data.measures_all.forEach(d => {
                            if (d[0] == "LOC")
                                d_data.loc = d[1]
                            if (d[0] == "NOM")
                                d_data.total_no_methods = d[1]
                        })
                        delete d_data.measures_all;
                    }

                    res.json(d_data);
                });
        });
}


export async function getCoverageOverall(req, res, next) {
    sqlParams(req, res, next)
    var features = {};
    var select = [];
    var joins = [];
    if (req.query.features)
        req.query.features.split(',').forEach(d => features[d] = true)
    var filters = '';
    if (req.query.filters)
        filters = req.query.filters.split(',')
            .map(d => {
                var t = d.split(':');
                var key = t[0];
                var values = t[1].split(';');
                if (values.length == 1) {
                    if (values[0] == 0 || values[0] == 'All')
                        return '';
                    return `And ${key}=${req.pushSqlParams(values, key)}`;
                } else {
                    return `And ${key}=${req.pushSqlParams(values, key)}`;
                }
            }).join(' ')


    if (features.unit_test) {
        select.push(...['test_ag.unit_test', 'test_ag.unit_test_total', 'test_ag.unit_test_percentage', 'test_ag.unit_test_ignored', 'test_ag.ignored_test_cases', 'test_ag.failed_test_cases'])
        joins.push(`
        INNER JOIN (
            SELECT test_parent_id as node_id,
            sum(CASE WHEN test_status='SUCCESS' THEN 1 ELSE 0 END) AS unit_test,
            bool_or(CASE WHEN test_status='IGNORED' THEN true ELSE false END) AS unit_test_ignored,
            sum(CASE WHEN test_status='IGNORED' THEN 1 ELSE 0 END) AS ignored_test_cases,
            sum(CASE WHEN test_status='FAIL' THEN 1 ELSE 0 END) AS failed_test_cases,
            count(test_status) as unit_test_total,
            (sum(CASE WHEN test_status='SUCCESS' THEN 1 ELSE 0 END)::float/greatest(count(test_status)::float,1))*100 as unit_test_percentage
            from unit_test
            where unit_test.test_snapshot_id = ${req.pushSqlParams(req.query.snapshot_id, 'snapshot_id')}
            group by test_parent_id
        ) test_ag on (test_ag.node_id = nodes.id)
        `)
    }

    if (features.lineCoverage || features.branchCoverage) {
        select.push(...CoverageSqlConstraint.select);
        select.push('mlocT.mloc');
        select.push('(lineCoverage::float/greatest(mlocT.mloc::float,1)*100) as lineCoverage_percentage_with_mloc');
        joins.push('Inner join ' + CoverageSqlConstraint.join(req));
        joins.push(`Inner join ${nodesService.nodeLOC(req)} on (mlocT.id=nodes.id)`);

    }

    nodesService.nodeInfo(req, {
        onlyCount: true,
        select: select,
        joins: joins,
        outerWhere: filters
    })
        .then(countData => {
            // return res.json(5)
            if (_.isEmpty(countData))
                return res.json({
                    total_components: 0,
                    components: []
                })


            nodesService.nodeInfo(req, {
                select: select,
                joins: joins,
                outerWhere: filters
            })
                .then(data => {
                    countData.components = data;
                    res.json(countData)
                })
        })

}

export async function getCoverageDistribution(req, res, next) {

    sqlParams(req, res, next)

    nodesService.nodeInfo(req, {
        select: CoverageSqlConstraint.select,
        nos: true,
        joins: ['left outer JOIN ' + CoverageSqlConstraint.join(req)]
    })
        .then(nodeData => {

            var coverageSum = {};
            nodeData.forEach(d => {
                if (!coverageSum[d.module_id])
                    coverageSum[d.module_id] = {
                        coverage_loc: 0,
                        non_coverage_loc: 0,
                        total_loc: 0
                    };
                coverageSum[d.module_id].coverage_loc += Math.round(d.linecoverage);
                coverageSum[d.module_id].total_loc += Math.round(d.loc);
                coverageSum[d.module_id].non_coverage_loc += Math.round(d.loc - d.linecoverage);
            })
            var module_ids = [];
            nodeData.forEach(d => {
                if (d.module_id)
                    module_ids.push(d.module_id)
            })
            if (_.isEmpty(module_ids))
                return res.json([]);


            nodesService.nodeModuleInfo(module_ids, req)
                .then(modData => {
                    modData.forEach(d => {
                        _.extend(d, coverageSum[d.id])
                    })
                    var resData = {};
                    resData.components_coverage_detail = coverageSum[-1];
                    resData.dataList = modData;
                    res.json(resData)
                })
        })
}
