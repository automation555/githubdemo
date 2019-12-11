import gamma from '../../../core/gamma';
import * as cf from '../../../utils/common-functions';
import _ from 'underscore';

var sqlQuery;
//Expose Modules
// module.exports.addRoutes = addRoutes;
// module.exports.getPluginName = getPluginName;
// // module.exports.getSubsystemDashboarddetail = getSubsystemDashboarddetail;

// function addRoutes() {
//     // gamma.get('/subsystemdashboard/getsubsystemdashboarddetail',getSubsystemDashboarddetail);
//     gamma.get('/kpi/details', getKpiDetails);
//     gamma.get('/kpi/loc', getLoc);
//     gamma.get('/kpi/hotspotloc', getHotspot);
// }

export async function getKpiDetails(req, res, next) {

    sqlQuery = `with x as (select id from nodes where parentid = $1)
                select x.id as node_id, ci.name as issue_name, count(co.id) as count from x, nodes n, code_issues_occurrences co, code_issues ci
                where (n.path like (SELECT path FROM nodes WHERE nodes.id = x.id)||'.%' or n.path = (SELECT path FROM nodes WHERE nodes.id = x.id))
                and n.excluded=false
                and n.id=co.component_id
                and co.snapshot_id=$2
                and ci.id=co.code_issue_id
                and co.is_suppress=false
                group by x.id, issue_name`;

    return req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id],next)
        .then(data => {
            let escapedData = data.map(d => {
                d = { ...d,
                    issue_name: cf.escapeRegExp(d.issue_name)
                };
                return d;
            });
            var issues = _.reject(_.uniq(_.pluck(escapedData, 'issue_name')), d => d == "'.").join('|');
            sqlQuery = `
            SELECT distinct(kpi),LOWER(lmr.rule_key) as rule
            FROM kpi
            left outer JOIN kpi_language_module_rules klmr ON klmr.kpi_id = kpi.id
            left outer JOIN language_module_rules lmr ON lmr.id= klmr.language_module_rules_id
            left outer JOIN language_module lrules ON lmr.language_module_id = lrules.id
            left outer JOIN language ON language.id= lrules.language_id
            where (kpi.tenant_id = $1 or kpi.tenant_id is null) and
            lmr.rule_key ~* '${issues}'`;

            req.gamma.query(sqlQuery, [req.session.tenant_id],next)
                .then(data2 => {
                    var kpiMore = _.groupBy(data2, 'rule');
                    var nodeKpiData = [];
                    data.forEach(d => {
                        d.kpi = [];
                        if (kpiMore[d.issue_name.toLowerCase()] && kpiMore[d.issue_name.toLowerCase()].length) {
                            _.each(kpiMore[d.issue_name.toLowerCase()], (val, key) => {
                                (d.kpi).push(val.kpi);
                            });
                        }
                    });

                    data.forEach(d => {
                        if ((d.kpi).length > 1) {
                            _.each(d.kpi, (val, key) => {
                                var obj = { 'node_id': d.node_id, 'issue_name': d.issue_name, 'count': d.count, 'kpi': [val] };
                                nodeKpiData.push(obj);
                            });
                        }
                        else
                            nodeKpiData.push(d);
                    });
                    var kpiData = [];
                    _.each(_.groupBy(nodeKpiData, 'kpi'), (v, k) => {
                        var d = {};
                        if (k != "") {
                            d.kpi_name = k;
                            d.kpi = {};
                            _.each(_.groupBy(v, 'node_id'), (v2, k2) => {
                                // d.kpi[k2]=_.pluck(v2,'count')
                                d.kpi[k2] = _.reduce(v2, (sum, d) => sum + (d.count - 0), 0)
                            })
                            kpiData.push(d);
                        }
                    });
                    kpiData = _.reject(kpiData, d => d.kpi_name == "undefined")
                    var kpiDataN = {};
                    kpiData.forEach(d => {
                        _.each(d.kpi, (v, k) => {
                            if (!kpiDataN[k])
                                kpiDataN[k] = {}
                            kpiDataN[k][d.kpi_name] = v;
                        })
                    });
                    sqlQuery = `select DISTINCT * from get_node_level($1, $2, $3) ORDER BY id`;
                    return req.corona.query(sqlQuery, [req.query.subsystem, req.query.node_id, req.query.snapshot_id],next)
                    .then(nodes=>{
                        var childNodeIds = _.pluck(nodes,'id');
                        sqlQuery = `select language_name from languages where id = (select language_id from nodes where id=$1)`;
                        return req.corona.query(sqlQuery, [childNodeIds[0]])
                        .then(language_data => {
                            sqlQuery = `SELECT distinct kpi
                            FROM kpi
                            left outer JOIN kpi_language_module_rules klmr ON klmr.kpi_id = kpi.id
                            left outer JOIN language_module_rules lmr ON lmr.id= klmr.language_module_rules_id
                            left outer JOIN language_module lrules ON lmr.language_module_id = lrules.id
                            left outer JOIN language ON language.id= lrules.language_id
                            where (kpi.tenant_id=$1 or kpi.tenant_id is null) and language.name=$2`;

                            return req.gamma.query(sqlQuery, [req.session.tenant_id, language_data[0].language_name],next)
                                .then(data => _.pluck(data, 'kpi'))
                                .then(kpi_keys => {

                                    childNodeIds.forEach(d => {
                                        if (!kpiDataN[d])
                                            kpiDataN[d] = {};
                                    });
                                    var newKpiKeys = [], keyItem = "", itemCounter = 0;
                                    _.each(kpiDataN, (v, k) => {
                                        keyItem = _.keys(v);
                                        keyItem.forEach(d => {
                                            if (newKpiKeys.indexOf(d) === -1 && d != "") {
                                                newKpiKeys.push(d);
                                            };
                                        });
                                    });
                                    _.each(kpiDataN, (v, k) => {
                                        itemCounter = 0;
                                        newKpiKeys.forEach(d => {
                                            if (!kpiDataN[k][d]) {
                                                kpiDataN[k][d] = 0;
                                                itemCounter++;
                                            }
                                        });
                                        if (itemCounter == newKpiKeys.length) {
                                            delete kpiDataN[k];
                                        }
                                    });
                                    var kpiDistribution = {
                                        'module_list': nodes,
                                        'kpi_list': kpiDataN
                                    };
                                    res.json(kpiDistribution);
                                });
                            });
                    });
                });

        });
}



export function getLoc(req, res, next) {
    /*sql_query = req.query.node
        .map(d => `(select n.id,get_node_measure_count($1,'LOC',$2,${d},nt.classification) as loc from node_types nt,nodes n where n.nodetype=nt.id and n.id=${d})`)
        .join('\n Union \n');*/

    sqlQuery = `with x as (select id from nodes where parentid = $1)
select n.id,get_node_measure_count($2,'LOC',$3,x.id) as loc from node_types nt,nodes n,x where n.nodetype=nt.id and n.id=x.id`;

    req.corona.query(sqlQuery, [req.query.node_id, req.query.subsystem, req.query.snapshot_id])
        .then(data => {
            data=_.reject(data,d=>!d.loc);
            data=_.groupBy(data,'id');
            _.each(data,(v,k)=>{
                data[k]=v[0].loc
            })
            res.json(data);
        });
}

export function getHotspot(req, res, next) {
    sqlQuery = `with x1 as (select id from nodes where parentid = $1)
                select x1.id,a.loc from x1 left join
                (with x as (select id from nodes where parentid = $1)
                select
                            x.id as id,sum(measurements.value) as loc
                            from x, nodes
                            INNER JOIN measurements ON (nodes.id=measurements.nodeid)
                            INNER JOIN snapshots ON (measurements.snapshotid = snapshots.id)
                            INNER JOIN ratings_values ON (snapshots.id = ratings_values.snapshotid and nodes.id=ratings_values.nodeid)
                            INNER JOIN ratings ON (ratings_values.ratingid = ratings.id)
                            where nodes.classification='T'
                            and nodes.path like (SELECT path FROM nodes WHERE nodes.id = x.id) ||'.%'
                            and nodes.excluded=false
                            AND measurements.measureid = (SELECT id FROM   measures WHERE  measurename = 'NOS')
                            AND snapshots.id = $2
                            AND ratings.rating = 'overallRating'
                            And ratings_values.rating_value < 0
                            group by x.id)
                a
                on x1.id=a.id`;

    req.corona.query(sqlQuery, [req.query.node_id, req.query.snapshot_id])
        .then(data => {
             var totalLoc={};
            data.forEach(d=>{
                totalLoc[d.id]=d.loc || 0;
            });
            res.json(totalLoc);
        });

}

